type MIPSMemory = Uint8Array;

interface MIPSState {
  registers: Int32Array;
  pc: number;
  memory: MIPSMemory;
  hi: number;
  lo: number;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  halted: boolean;
}

interface MIPSInstruction {
  opcode: number;
  rs: number;
  rt: number;
  rd: number;
  shamt: number;
  funct: number;
  imm: number;
  addr: number;
}

interface AssemblerResult {
  machineCode: Uint32Array;
  textAddress: number;
  dataAddress: number;
  labels: Map<string, number>;
  error?: string;
}

const PSEUDO_INSTRUCTIONS: Record<string, (tokens: string[], labels: Map<string, number>, currentAddr: number) => number> = {
  'li': (tokens, labels) => {
    const imm = parseImmediate(tokens[2], labels);
    if (imm === null) return 0;
    return (imm > 0xFFFF || imm < -0x8000) ? 2 : 1;
  },
  'la': () => 2,
  'move': () => 1,
  'nop': () => 1,
};

function expandPseudoInstruction(tokens: string[], labels: Map<string, number>, currentAddr: number): number[] {
  const instr = tokens[0].toLowerCase();
  const instructions: number[] = [];
  
  switch (instr) {
    case 'li': {
      const rt = parseRegister(tokens[1]);
      const imm = parseImmediate(tokens[2], labels);
      if (rt === null || imm === null) return [];
      
      // If value fits in 16 bits, use ori $zero, rt, imm
      // Otherwise use lui + ori
      if (imm >= -0x8000 && imm <= 0xFFFF) {
        // ori $zero, rt, imm (opcode 0x0d)
        const machineCode = (0x0d << 26) | (0 << 21) | (rt << 16) | (imm & 0xFFFF);
        instructions.push(machineCode >>> 0);
      } else {
        // lui rt, upper(imm) followed by ori rt, rt, lower(imm)
        const upper = (imm >>> 16) & 0xFFFF;
        const lower = imm & 0xFFFF;
        const luiCode = (0x0f << 26) | (0 << 21) | (rt << 16) | upper;
        const oriCode = (0x0d << 26) | (rt << 21) | (rt << 16) | lower;
        instructions.push(luiCode >>> 0, oriCode >>> 0);
      }
      break;
    }
    case 'la': {
      const rt = parseRegister(tokens[1]);
      const addr = parseImmediate(tokens[2], labels);
      if (rt === null || addr === null) return [];
      
      // lui rt, upper(addr) followed by ori rt, rt, lower(addr)
      const upper = (addr >>> 16) & 0xFFFF;
      const lower = addr & 0xFFFF;
      const luiCode = (0x0f << 26) | (0 << 21) | (rt << 16) | upper;
      const oriCode = (0x0d << 26) | (rt << 21) | (rt << 16) | lower;
      instructions.push(luiCode >>> 0, oriCode >>> 0);
      break;
    }
    case 'move': {
      const rd = parseRegister(tokens[1]);
      const rs = parseRegister(tokens[2]);
      if (rd === null || rs === null) return [];
      
      // or rd, rs, $zero (R-type: funct 0x25)
      const machineCode = (rs << 21) | (0 << 16) | (rd << 11) | 0x25;
      instructions.push(machineCode >>> 0);
      break;
    }
    case 'nop': {
      // sll $zero, $zero, 0 (R-type: funct 0x00)
      instructions.push(0 >>> 0);
      break;
    }
  }
  
  return instructions;
}

const REG_NAMES: Record<string, number> = {
  zero: 0, at: 1, v0: 2, v1: 3, a0: 4, a1: 5, a2: 6, a3: 7,
  t0: 8, t1: 9, t2: 10, t3: 11, t4: 12, t5: 13, t6: 14, t7: 15,
  s0: 16, s1: 17, s2: 18, s3: 19, s4: 20, s5: 21, s6: 22, s7: 23,
  t8: 24, t9: 25, k0: 26, k1: 27, gp: 28, sp: 29, fp: 30, ra: 31,
  $zero: 0, $at: 1, $v0: 2, $v1: 3, $a0: 4, $a1: 5, $a2: 6, $a3: 7,
  $t0: 8, $t1: 9, $t2: 10, $t3: 11, $t4: 12, $t5: 13, $t6: 14, $t7: 15,
  $s0: 16, $s1: 17, $s2: 18, $s3: 19, $s4: 20, $s5: 21, $s6: 22, $s7: 23,
  $t8: 24, $t9: 25, $k0: 26, $k1: 27, $gp: 28, $sp: 29, $fp: 30, $ra: 31,
  r0: 0, r1: 1, r2: 2, r3: 3, r4: 4, r5: 5, r6: 6, r7: 7,
  r8: 8, r9: 9, r10: 10, r11: 11, r12: 12, r13: 13, r14: 14, r15: 15,
  r16: 16, r17: 17, r18: 18, r19: 19, r20: 20, r21: 21, r22: 22, r23: 23,
  r24: 24, r25: 25, r26: 26, r27: 27, r28: 28, r29: 29, r30: 30, r31: 31,
};

const OPCODES: Record<string, number> = {
  addi: 0x08, addiu: 0x09, andi: 0x0c, ori: 0x0d, xori: 0x0e,
  lui: 0x0f, lw: 0x23, sw: 0x2b, lb: 0x20, sb: 0x28, lbu: 0x24,
  beq: 0x04, bne: 0x05, bgtz: 0x07, blez: 0x06, slti: 0x0a, sltiu: 0x0b,
  j: 0x02, jal: 0x03,
};

const FUNCTS: Record<string, number> = {
  add: 0x20, addu: 0x21, sub: 0x22, subu: 0x23, and: 0x24, or: 0x25,
  xor: 0x26, nor: 0x27, slt: 0x2a, sltu: 0x2b, sll: 0x00, srl: 0x02,
  sra: 0x03, sllv: 0x04, srlv: 0x06, srav: 0x07, jr: 0x08, jalr: 0x09,
  mult: 0x18, multu: 0x19, div: 0x1a, divu: 0x1b, mfhi: 0x10, mflo: 0x12,
  mthi: 0x11, mtlo: 0x13,   syscall: 0x0c,
};

function parseRegister(token: string): number | null {
  const reg = REG_NAMES[token.toLowerCase()];
  return reg !== undefined ? reg : null;
}

function parseImmediate(token: string, labels: Map<string, number>): number | null {
  const labelAddr = labels.get(token);
  if (labelAddr !== undefined) {
    return labelAddr;
  }
  
  if (token.startsWith('0x') || token.startsWith('0X')) {
    const val = parseInt(token.slice(2), 16);
    return isNaN(val) ? null : val;
  }
  
  if (token.startsWith('-')) {
    const val = parseInt(token, 10);
    return isNaN(val) ? null : (val & 0xffff);
  }
  
  const val = parseInt(token, 10);
  return isNaN(val) ? null : val;
}

function tokenizeLine(line: string): string[] {
  return line
    .replace(/#.*$/, '')
    .replace(/,/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 0);
}

function assemble(source: string): AssemblerResult {
  const lines = source.split('\n');
  const labels = new Map<string, number>();
  const textStart = 0x00400000;
  const dataStart = 0x10010000;
  
  const textSection: number[] = [];
  const dataSection: number[] = [];
  
  let currentSection: 'text' | 'data' = 'text';
  let textAddr = textStart;
  let dataAddr = dataStart;
  
  // First pass: collect labels
  for (const line of lines) {
    const tokens = tokenizeLine(line);
    if (tokens.length === 0) continue;
    
    let tokenIdx = 0;
    
    // Check for label
    if (tokens[0].endsWith(':')) {
      const label = tokens[0].slice(0, -1);
      if (currentSection === 'text') {
        labels.set(label, textAddr);
      } else {
        labels.set(label, dataAddr);
      }
      tokenIdx = 1;
    }
    
    if (tokenIdx >= tokens.length) continue;
    
    const directive = tokens[tokenIdx].toLowerCase();
    
    if (directive === '.text') {
      currentSection = 'text';
      continue;
    }
    if (directive === '.data') {
      currentSection = 'data';
      continue;
    }
    
    if (currentSection === 'text') {
      const instr = tokens[tokenIdx].toLowerCase();
      const pseudoHandler = PSEUDO_INSTRUCTIONS[instr];
      if (pseudoHandler) {
        const count = pseudoHandler(tokens.slice(tokenIdx), labels, textAddr);
        textAddr += count * 4;
      } else {
        textAddr += 4;
      }
    } else {
      if (directive === '.word') {
        dataAddr += (tokens.length - tokenIdx - 1) * 4;
      } else if (directive === '.asciiz' || directive === '.ascii') {
        const str = line.slice(line.indexOf('"') + 1, line.lastIndexOf('"'));
        dataAddr += str.length + (directive === '.asciiz' ? 1 : 0);
      } else if (directive === '.space') {
        const size = parseInt(tokens[tokenIdx + 1], 10);
        dataAddr += isNaN(size) ? 0 : size;
      }
    }
  }
  
  // Second pass: generate code
  textAddr = textStart;
  dataAddr = dataStart;
  currentSection = 'text';
  
  for (const line of lines) {
    const tokens = tokenizeLine(line);
    if (tokens.length === 0) continue;
    
    let tokenIdx = 0;
    
    // Skip label
    if (tokens[0].endsWith(':')) {
      tokenIdx = 1;
    }
    
    if (tokenIdx >= tokens.length) continue;
    
    const directive = tokens[tokenIdx].toLowerCase();
    
    if (directive === '.text') {
      currentSection = 'text';
      continue;
    }
    if (directive === '.data') {
      currentSection = 'data';
      continue;
    }
    
    if (currentSection === 'text') {
      const instr = tokens[tokenIdx];
      const instrLower = instr.toLowerCase();
      const opcode = OPCODES[instrLower];
      const funct = FUNCTS[instrLower];
      const pseudoHandler = PSEUDO_INSTRUCTIONS[instrLower];
      
      if (pseudoHandler) {
        // Expand pseudo-instruction
        const pseudoInstrs = expandPseudoInstruction(tokens.slice(tokenIdx), labels, textAddr);
        for (const pseudoInstr of pseudoInstrs) {
          textSection.push(pseudoInstr);
          textAddr += 4;
        }
        continue;
      }
      
      let machineCode = 0;
      
      if (opcode !== undefined) {
        // I-type or J-type
        machineCode = opcode << 26;
        
        if (instr.toLowerCase() === 'j' || instr.toLowerCase() === 'jal') {
          // J-type
          const addr = parseImmediate(tokens[tokenIdx + 1], labels);
          if (addr === null) {
            return { machineCode: new Uint32Array(0), textAddress: textStart, dataAddress: dataStart, labels, error: `Invalid jump target: ${tokens[tokenIdx + 1]}` };
          }
          machineCode |= (addr >> 2) & 0x3ffffff;
        } else if (instr.toLowerCase().startsWith('b')) {
          // Branch
          const rs = parseRegister(tokens[tokenIdx + 1]);
          const rt = instr.toLowerCase() === 'bgtz' || instr.toLowerCase() === 'blez' ? 0 : parseRegister(tokens[tokenIdx + 2]);
          let offset: number;
          
          if (instr.toLowerCase() === 'bgtz' || instr.toLowerCase() === 'blez') {
            const label = parseImmediate(tokens[tokenIdx + 2], labels);
            if (label === null) {
              return { machineCode: new Uint32Array(0), textAddress: textStart, dataAddress: dataStart, labels, error: `Invalid branch target: ${tokens[tokenIdx + 2]}` };
            }
            offset = ((label - (textAddr + 4)) >> 2);
          } else {
            const label = parseImmediate(tokens[tokenIdx + 3], labels);
            if (label === null) {
              return { machineCode: new Uint32Array(0), textAddress: textStart, dataAddress: dataStart, labels, error: `Invalid branch target: ${tokens[tokenIdx + 3]}` };
            }
            offset = ((label - (textAddr + 4)) >> 2);
          }
          
          if (rs === null || rt === null) {
            return { machineCode: new Uint32Array(0), textAddress: textStart, dataAddress: dataStart, labels, error: `Invalid registers in branch: ${line}` };
          }
          
          machineCode |= (rs << 21) | (rt << 16) | (offset & 0xffff);
        } else if (instr.toLowerCase() === 'lui') {
          const rt = parseRegister(tokens[tokenIdx + 1]);
          const imm = parseImmediate(tokens[tokenIdx + 2], labels);
          if (rt === null || imm === null) {
            return { machineCode: new Uint32Array(0), textAddress: textStart, dataAddress: dataStart, labels, error: `Invalid operands in lui: ${line}` };
          }
          machineCode |= (rt << 16) | (imm & 0xffff);
        } else {
          // I-type
          const rt = parseRegister(tokens[tokenIdx + 1]);
          let rs: number | null;
          let imm: number | null;
          
          // Check for offset(base) format
          const offsetMatch = tokens[tokenIdx + 2]?.match(/(-?\d+|\w+)\((\$?\w+)\)/);
          if (offsetMatch) {
            rs = parseRegister(offsetMatch[2]);
            imm = parseImmediate(offsetMatch[1], labels);
          } else {
            rs = parseRegister(tokens[tokenIdx + 2]);
            imm = parseImmediate(tokens[tokenIdx + 3], labels);
          }
          
          if (rt === null || rs === null || imm === null) {
            return { machineCode: new Uint32Array(0), textAddress: textStart, dataAddress: dataStart, labels, error: `Invalid I-type operands: ${line}` };
          }
          
          machineCode |= (rs << 21) | (rt << 16) | (imm & 0xffff);
        }
      } else if (funct !== undefined) {
        // R-type
        machineCode = funct;
        
        if (instr.toLowerCase() === 'syscall') {
          // syscall is just funct = 0x0c
        } else if (instr.toLowerCase() === 'jr') {
          const rs = parseRegister(tokens[tokenIdx + 1]);
          if (rs === null) {
            return { machineCode: new Uint32Array(0), textAddress: textStart, dataAddress: dataStart, labels, error: `Invalid jr operand: ${line}` };
          }
          machineCode |= (rs << 21);
        } else if (instr.toLowerCase() === 'mfhi' || instr.toLowerCase() === 'mflo') {
          const rd = parseRegister(tokens[tokenIdx + 1]);
          if (rd === null) {
            return { machineCode: new Uint32Array(0), textAddress: textStart, dataAddress: dataStart, labels, error: `Invalid mfhi/mflo operand: ${line}` };
          }
          machineCode |= (rd << 11);
        } else if (instr.toLowerCase() === 'sll' || instr.toLowerCase() === 'srl' || instr.toLowerCase() === 'sra') {
          const rd = parseRegister(tokens[tokenIdx + 1]);
          const rt = parseRegister(tokens[tokenIdx + 2]);
          const shamt = parseImmediate(tokens[tokenIdx + 3], labels);
          if (rd === null || rt === null || shamt === null) {
            return { machineCode: new Uint32Array(0), textAddress: textStart, dataAddress: dataStart, labels, error: `Invalid shift operands: ${line}` };
          }
          machineCode |= (rt << 16) | (rd << 11) | (shamt & 0x1f);
        } else {
          const rd = parseRegister(tokens[tokenIdx + 1]);
          const rs = parseRegister(tokens[tokenIdx + 2]);
          const rt = parseRegister(tokens[tokenIdx + 3]);
          if (rd === null || rs === null || rt === null) {
            return { machineCode: new Uint32Array(0), textAddress: textStart, dataAddress: dataStart, labels, error: `Invalid R-type operands: ${line}` };
          }
          machineCode |= (rs << 21) | (rt << 16) | (rd << 11);
        }
      } else {
        return { machineCode: new Uint32Array(0), textAddress: textStart, dataAddress: dataStart, labels, error: `Unknown instruction: ${instr}` };
      }
      
      textSection.push(machineCode);
      textAddr += 4;
    } else {
      // Data section
      if (directive === '.word') {
        for (let i = tokenIdx + 1; i < tokens.length; i++) {
          const val = parseImmediate(tokens[i], labels);
          if (val === null) {
            return { machineCode: new Uint32Array(0), textAddress: textStart, dataAddress: dataStart, labels, error: `Invalid .word value: ${tokens[i]}` };
          }
          dataSection.push(val);
          dataAddr += 4;
        }
      } else if (directive === '.asciiz' || directive === '.ascii') {
        const str = line.slice(line.indexOf('"') + 1, line.lastIndexOf('"'));
        for (const char of str) {
          dataSection.push(char.charCodeAt(0));
        }
        if (directive === '.asciiz') {
          dataSection.push(0);
        }
        dataAddr += str.length + (directive === '.asciiz' ? 1 : 0);
      } else if (directive === '.space') {
        const size = parseInt(tokens[tokenIdx + 1], 10);
        if (isNaN(size)) {
          return { machineCode: new Uint32Array(0), textAddress: textStart, dataAddress: dataStart, labels, error: `Invalid .space size: ${tokens[tokenIdx + 1]}` };
        }
        for (let i = 0; i < size; i++) {
          dataSection.push(0);
        }
        dataAddr += size;
      }
    }
  }
  
  // Combine text and data
  const totalSize = textSection.length * 4 + dataSection.length;
  const machineCode = new Uint32Array(totalSize / 4 + (totalSize % 4 ? 1 : 0));
  
  for (let i = 0; i < textSection.length; i++) {
    machineCode[i] = textSection[i];
  }
  
  for (let i = 0; i < dataSection.length; i += 4) {
    let word = 0;
    for (let j = 0; j < 4 && i + j < dataSection.length; j++) {
      word |= (dataSection[i + j] & 0xff) << (j * 8);
    }
    machineCode[textSection.length + Math.floor(i / 4)] = word;
  }
  
  return {
    machineCode,
    textAddress: textStart,
    dataAddress: dataStart,
    labels,
  };
}

function decodeInstruction(instruction: number): MIPSInstruction {
  return {
    opcode: (instruction >>> 26) & 0x3f,
    rs: (instruction >>> 21) & 0x1f,
    rt: (instruction >>> 16) & 0x1f,
    rd: (instruction >>> 11) & 0x1f,
    shamt: (instruction >>> 6) & 0x1f,
    funct: instruction & 0x3f,
    imm: instruction & 0xffff,
    addr: instruction & 0x3ffffff,
  };
}

function signExtend16(value: number): number {
  return (value & 0x8000) ? (value | 0xffff0000) : value;
}

function zeroExtend16(value: number): number {
  return value & 0xffff;
}

function createState(memorySize: number = 64 * 1024 * 1024): MIPSState {
  return {
    registers: new Int32Array(32),
    pc: 0x00400000,
    memory: new Uint8Array(memorySize),
    hi: 0,
    lo: 0,
    stdout: '',
    stderr: '',
    exitCode: null,
    halted: false,
  };
}

function loadProgram(state: MIPSState, result: AssemblerResult): void {
  // Load text section
  const textOffset = result.textAddress;
  for (let i = 0; i < result.machineCode.length; i++) {
    const addr = textOffset + i * 4;
    const word = result.machineCode[i];
    state.memory[addr] = word & 0xff;
    state.memory[addr + 1] = (word >>> 8) & 0xff;
    state.memory[addr + 2] = (word >>> 16) & 0xff;
    state.memory[addr + 3] = (word >>> 24) & 0xff;
  }
  
  // Set $gp to data segment
  state.registers[28] = result.dataAddress;
  
  // Set $sp to end of memory
  state.registers[29] = state.memory.length - 4;
}

function readWord(state: MIPSState, addr: number): number {
  return state.memory[addr] |
    (state.memory[addr + 1] << 8) |
    (state.memory[addr + 2] << 16) |
    (state.memory[addr + 3] << 24);
}

function writeWord(state: MIPSState, addr: number, value: number): void {
  state.memory[addr] = value & 0xff;
  state.memory[addr + 1] = (value >>> 8) & 0xff;
  state.memory[addr + 2] = (value >>> 16) & 0xff;
  state.memory[addr + 3] = (value >>> 24) & 0xff;
}

function executeStep(state: MIPSState, stdin: string): { consumedStdin: boolean } {
  if (state.halted || state.exitCode !== null) {
    return { consumedStdin: false };
  }
  
  const instruction = readWord(state, state.pc);
  const instr = decodeInstruction(instruction);
  
  state.pc += 4;
  
  // Handle R-type
  if (instr.opcode === 0) {
    switch (instr.funct) {
      case 0x20: // add
        state.registers[instr.rd] = state.registers[instr.rs] + state.registers[instr.rt];
        break;
      case 0x21: // addu
        state.registers[instr.rd] = (state.registers[instr.rs] >>> 0) + (state.registers[instr.rt] >>> 0);
        break;
      case 0x22: // sub
        state.registers[instr.rd] = state.registers[instr.rs] - state.registers[instr.rt];
        break;
      case 0x23: // subu
        state.registers[instr.rd] = (state.registers[instr.rs] >>> 0) - (state.registers[instr.rt] >>> 0);
        break;
      case 0x24: // and
        state.registers[instr.rd] = state.registers[instr.rs] & state.registers[instr.rt];
        break;
      case 0x25: // or
        state.registers[instr.rd] = state.registers[instr.rs] | state.registers[instr.rt];
        break;
      case 0x26: // xor
        state.registers[instr.rd] = state.registers[instr.rs] ^ state.registers[instr.rt];
        break;
      case 0x27: // nor
        state.registers[instr.rd] = ~(state.registers[instr.rs] | state.registers[instr.rt]);
        break;
      case 0x2a: // slt
        state.registers[instr.rd] = state.registers[instr.rs] < state.registers[instr.rt] ? 1 : 0;
        break;
      case 0x2b: // sltu
        state.registers[instr.rd] = (state.registers[instr.rs] >>> 0) < (state.registers[instr.rt] >>> 0) ? 1 : 0;
        break;
      case 0x00: // sll
        state.registers[instr.rd] = state.registers[instr.rt] << instr.shamt;
        break;
      case 0x02: // srl
        state.registers[instr.rd] = (state.registers[instr.rt] >>> 0) >>> instr.shamt;
        break;
      case 0x03: // sra
        state.registers[instr.rd] = state.registers[instr.rt] >> instr.shamt;
        break;
      case 0x04: // sllv
        state.registers[instr.rd] = state.registers[instr.rt] << (state.registers[instr.rs] & 0x1f);
        break;
      case 0x06: // srlv
        state.registers[instr.rd] = (state.registers[instr.rt] >>> 0) >>> (state.registers[instr.rs] & 0x1f);
        break;
      case 0x07: // srav
        state.registers[instr.rd] = state.registers[instr.rt] >> (state.registers[instr.rs] & 0x1f);
        break;
      case 0x08: // jr
        state.pc = state.registers[instr.rs];
        break;
      case 0x09: // jalr
        state.registers[31] = state.pc;
        state.pc = state.registers[instr.rs];
        break;
      case 0x18: // mult
        {
          const result = BigInt.asIntN(64, BigInt(state.registers[instr.rs]) * BigInt(state.registers[instr.rt]));
          state.lo = Number(result & BigInt(0xffffffff));
          state.hi = Number(result >> BigInt(32));
        }
        break;
      case 0x19: // multu
        {
          const result = BigInt(state.registers[instr.rs] >>> 0) * BigInt(state.registers[instr.rt] >>> 0);
          state.lo = Number(result & BigInt(0xffffffff));
          state.hi = Number(result >> BigInt(32));
        }
        break;
      case 0x1a: // div
        if (state.registers[instr.rt] !== 0) {
          state.lo = Math.trunc(state.registers[instr.rs] / state.registers[instr.rt]);
          state.hi = state.registers[instr.rs] % state.registers[instr.rt];
        }
        break;
      case 0x1b: // divu
        if (state.registers[instr.rt] !== 0) {
          state.lo = Math.trunc((state.registers[instr.rs] >>> 0) / (state.registers[instr.rt] >>> 0));
          state.hi = (state.registers[instr.rs] >>> 0) % (state.registers[instr.rt] >>> 0);
        }
        break;
      case 0x10: // mfhi
        state.registers[instr.rd] = state.hi;
        break;
      case 0x12: // mflo
        state.registers[instr.rd] = state.lo;
        break;
      case 0x11: // mthi
        state.hi = state.registers[instr.rs];
        break;
      case 0x13: // mtlo
        state.lo = state.registers[instr.rs];
        break;
      case 0x0c: // syscall
        return handleSyscall(state, stdin);
      default:
        state.stderr += `Unknown R-type funct: ${instr.funct.toString(16)}\n`;
        state.halted = true;
    }
  } else {
    // I-type and J-type
    switch (instr.opcode) {
      case 0x08: // addi
        state.registers[instr.rt] = state.registers[instr.rs] + signExtend16(instr.imm);
        break;
      case 0x09: // addiu
        state.registers[instr.rt] = (state.registers[instr.rs] >>> 0) + signExtend16(instr.imm);
        break;
      case 0x0c: // andi
        state.registers[instr.rt] = state.registers[instr.rs] & zeroExtend16(instr.imm);
        break;
      case 0x0d: // ori
        state.registers[instr.rt] = state.registers[instr.rs] | zeroExtend16(instr.imm);
        break;
      case 0x0e: // xori
        state.registers[instr.rt] = state.registers[instr.rs] ^ zeroExtend16(instr.imm);
        break;
      case 0x0f: // lui
        state.registers[instr.rt] = (instr.imm << 16);
        break;
      case 0x0a: // slti
        state.registers[instr.rt] = state.registers[instr.rs] < signExtend16(instr.imm) ? 1 : 0;
        break;
      case 0x0b: // sltiu
        state.registers[instr.rt] = (state.registers[instr.rs] >>> 0) < (signExtend16(instr.imm) >>> 0) ? 1 : 0;
        break;
      case 0x23: // lw
        state.registers[instr.rt] = readWord(state, state.registers[instr.rs] + signExtend16(instr.imm));
        break;
      case 0x2b: // sw
        writeWord(state, state.registers[instr.rs] + signExtend16(instr.imm), state.registers[instr.rt]);
        break;
      case 0x20: // lb
        state.registers[instr.rt] = signExtend16(state.memory[state.registers[instr.rs] + signExtend16(instr.imm)]);
        break;
      case 0x24: // lbu
        state.registers[instr.rt] = state.memory[state.registers[instr.rs] + signExtend16(instr.imm)];
        break;
      case 0x28: // sb
        state.memory[state.registers[instr.rs] + signExtend16(instr.imm)] = state.registers[instr.rt] & 0xff;
        break;
      case 0x04: // beq
        if (state.registers[instr.rs] === state.registers[instr.rt]) {
          state.pc += signExtend16(instr.imm) << 2;
        }
        break;
      case 0x05: // bne
        if (state.registers[instr.rs] !== state.registers[instr.rt]) {
          state.pc += signExtend16(instr.imm) << 2;
        }
        break;
      case 0x07: // bgtz
        if (state.registers[instr.rs] > 0) {
          state.pc += signExtend16(instr.imm) << 2;
        }
        break;
      case 0x06: // blez
        if (state.registers[instr.rs] <= 0) {
          state.pc += signExtend16(instr.imm) << 2;
        }
        break;
      case 0x02: // j
        state.pc = (state.pc & 0xf0000000) | (instr.addr << 2);
        break;
      case 0x03: // jal
        state.registers[31] = state.pc;
        state.pc = (state.pc & 0xf0000000) | (instr.addr << 2);
        break;
      default:
        state.stderr += `Unknown opcode: ${instr.opcode.toString(16)}\n`;
        state.halted = true;
    }
  }
  
  // $zero is always 0
  state.registers[0] = 0;
  
  return { consumedStdin: false };
}

function handleSyscall(state: MIPSState, stdin: string): { consumedStdin: boolean } {
  const syscallNum = state.registers[2]; // $v0
  let consumedStdin = false;
  
  switch (syscallNum) {
    case 1: // print_int
      state.stdout += state.registers[4]; // $a0
      break;
    case 4: // print_string
      {
        let addr = state.registers[4];
        let str = '';
        while (state.memory[addr] !== 0) {
          str += String.fromCharCode(state.memory[addr]);
          addr++;
        }
        state.stdout += str;
      }
      break;
    case 5: // read_int
      {
        const lines = stdin.split('\n');
        const line = lines[0] || '0';
        const val = parseInt(line.trim(), 10);
        state.registers[2] = isNaN(val) ? 0 : val;
        consumedStdin = true;
      }
      break;
    case 8: // read_string
      {
        const maxLen = state.registers[5]; // $a1
        const addr = state.registers[4]; // $a0
        const lines = stdin.split('\n');
        const line = lines[0] || '';
        for (let i = 0; i < Math.min(line.length, maxLen - 1); i++) {
          state.memory[addr + i] = line.charCodeAt(i);
        }
        state.memory[addr + Math.min(line.length, maxLen - 1)] = 0;
        consumedStdin = true;
      }
      break;
    case 10: // exit
      state.exitCode = 0;
      state.halted = true;
      break;
    case 11: // print_char
      state.stdout += String.fromCharCode(state.registers[4] & 0xff);
      break;
    case 12: // read_char
      {
        const char = stdin.charCodeAt(0) || 0;
        state.registers[2] = char;
        consumedStdin = true;
      }
      break;
    default:
      state.stderr += `Unknown syscall: ${syscallNum}\n`;
      state.halted = true;
  }
  
  return { consumedStdin };
}

function runMIPS(source: string, stdin: string = '', maxSteps: number = 100000): {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  steps: number;
  error?: string;
} {
  const assembleResult = assemble(source);
  
  if (assembleResult.error) {
    return {
      stdout: '',
      stderr: '',
      exitCode: null,
      steps: 0,
      error: `Assembly error: ${assembleResult.error}`,
    };
  }
  
  const state = createState();
  loadProgram(state, assembleResult);
  
  let stdinRemaining = stdin;
  let steps = 0;
  
  while (!state.halted && state.exitCode === null && steps < maxSteps) {
    const { consumedStdin } = executeStep(state, stdinRemaining);
    
    if (consumedStdin) {
      const lines = stdinRemaining.split('\n');
      stdinRemaining = lines.slice(1).join('\n');
    }
    
    steps++;
    
    // Check for PC out of bounds
    if (state.pc < 0 || state.pc >= state.memory.length) {
      state.stderr += `PC out of bounds: ${state.pc.toString(16)}\n`;
      state.halted = true;
    }
  }
  
  if (steps >= maxSteps && !state.halted) {
    state.stderr += `Execution limit reached (${maxSteps} steps)\n`;
  }
  
  return {
    stdout: state.stdout,
    stderr: state.stderr,
    exitCode: state.exitCode,
    steps,
  };
}

export { runMIPS, assemble };
export type { MIPSState, MIPSInstruction, AssemblerResult };
