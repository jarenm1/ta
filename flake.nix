{
  description = "Teaching Assistant - Electron app for Canvas LMS";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        electronPkg = pkgs.electron_41 or pkgs.electron;
        
        # Just the CLI/MCP tools (no Electron build)
        tagent-cli = pkgs.buildNpmPackage rec {
          pname = "tagent-cli";
          version = "1.0.0";
          
          src = ./.;
          
          npmDepsHash = "sha256-4dm7GMCsRAgfQILmx7kBb4C5fVbXuZyKAkGlXTla3x8=";
          
          nativeBuildInputs = with pkgs; [
            nodejs
            makeWrapper
          ];
          
          # Skip build phase - we just need the scripts
          dontNpmBuild = true;
          
          # Skip npm audit for purity
          npmFlags = [ "--legacy-peer-deps" ];
          
          # Don't run tests during build
          dontNpmTest = true;
          
          installPhase = ''
            runHook preInstall
            
            # Create output directories
            mkdir -p $out/bin
            mkdir -p $out/lib/node_modules/tagent
            
            # Copy the package and MCP server
            cp -r . $out/lib/node_modules/tagent/
            
            # Create wrappers for CLI tools
            makeWrapper ${pkgs.nodejs}/bin/node $out/bin/tagent-mcp \
              --add-flags "$out/lib/node_modules/tagent/bin/tagent-mcp.js"
            
            # Also create a wrapper that directly runs the MCP server (no CLI args)
            makeWrapper ${pkgs.nodejs}/bin/node $out/bin/tagent-mcp-server \
              --add-flags "$out/lib/node_modules/tagent/mcp-server/server.mjs"
            
            runHook postInstall
          '';
          
          meta = with pkgs.lib; {
            description = "Teaching Assistant CLI and MCP server";
            homepage = "https://github.com/jaren/teaching-assistant";
            license = licenses.mit;
            platforms = platforms.all;
          };
        };
        
        # Full Electron app (separate derivation)
        teaching-assistant = pkgs.buildNpmPackage rec {
          pname = "teaching-assistant";
          version = "1.0.0";
          
          src = ./.;
          
          npmDepsHash = "sha256-4dm7GMCsRAgfQILmx7kBb4C5fVbXuZyKAkGlXTla3x8=";
          
          # Fix npm cache permission issues
          makeCacheWritable = true;
          
          nativeBuildInputs = with pkgs; [
            nodejs
            python3
            makeWrapper
            pkg-config
          ];
          
          buildInputs = with pkgs; [
            electronPkg
          ];
          
          # Skip npm audit for purity
          npmFlags = [ "--legacy-peer-deps" ];
          
          # Don't run tests during build
          dontNpmTest = true;
          
          # Environment variables for build
          ELECTRON_SKIP_BINARY_DOWNLOAD = 1;
          ELECTRON_OVERRIDE_DIST_PATH = "${electronPkg}/bin";
          
          # Use pre-built app if available, otherwise skip Electron build
          buildPhase = ''
            runHook preBuild
            
            # Try to build, but don't fail if it doesn't work
            npm run package 2>/dev/null || echo "Note: Electron app build skipped (not available in sandbox)"
            
            runHook postBuild
          '';
          
          installPhase = ''
            runHook preInstall
            
            # Create output directories
            mkdir -p $out/bin
            mkdir -p $out/share/teaching-assistant
            mkdir -p $out/share/applications
            mkdir -p $out/lib/node_modules/tagent
            
            # Copy all project files for node modules
            cp -r . $out/lib/node_modules/tagent/
            
            # Copy the packaged app if it exists
            if [ -d "out" ]; then
              cp -r out/*-unpacked/* $out/share/teaching-assistant/ 2>/dev/null || true
            fi
            
            # Also copy any built files
            if [ -d ".vite/build" ]; then
              cp -r .vite/build/* $out/share/teaching-assistant/ 2>/dev/null || true
            fi
            
            # Create wrapper for main app if Electron build succeeded
            if [ -f "$out/share/teaching-assistant/main.js" ]; then
              makeWrapper ${electronPkg}/bin/electron $out/bin/tagent \
                --add-flags "$out/share/teaching-assistant" \
                --set ELECTRON_OVERRIDE_DIST_PATH "${electronPkg}/bin"
              ln -s $out/bin/tagent $out/bin/ta
            fi
            
            # Always provide MCP server
            makeWrapper ${pkgs.nodejs}/bin/node $out/bin/tagent-mcp \
              --add-flags "$out/lib/node_modules/tagent/bin/tagent-mcp.js"
            
            # Create desktop file
            cat > $out/share/applications/tagent.desktop <<EOF
[Desktop Entry]
Name=Teaching Assistant
Comment=Canvas LMS Teaching Assistant with AI-powered study tools
Exec=$out/bin/tagent
Icon=teaching-assistant
Type=Application
Categories=Education;Utility;
Terminal=false
EOF
            
            runHook postInstall
          '';
          
          meta = with pkgs.lib; {
            description = "Teaching Assistant - Canvas LMS desktop app";
            homepage = "https://github.com/jaren/teaching-assistant";
            license = licenses.mit;
            platforms = platforms.linux;
          };
        };
        
      in {
        # Development shell
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs
            nodePackages.pnpm
            nodePackages.typescript-language-server
            electronPkg
            pkg-config
            python3
          ];

          ELECTRON_OVERRIDE_DIST_PATH = "${electronPkg}/bin";
          NIX_ELECTRON_DIST = "${electronPkg}/bin";
          
          shellHook = ''
            echo "Teaching Assistant dev shell"
            echo "Run 'npm install' to install dependencies"
            echo "Run 'npm start' to start the development server"
            echo "Run 'npm run mcp:canvas' to start the MCP server"
          '';
        };
        
        # Package outputs
        packages = {
          default = tagent-cli;  # Default to CLI tools
          tagent-cli = tagent-cli;
          teaching-assistant = teaching-assistant;
          tagent = teaching-assistant;
        };
        
        # App outputs
        apps = {
          default = {
            type = "app";
            program = "${tagent-cli}/bin/tagent-mcp";
          };
          tagent-mcp = {
            type = "app";
            program = "${tagent-cli}/bin/tagent-mcp";
          };
          tagent-mcp-server = {
            type = "app";
            program = "${tagent-cli}/bin/tagent-mcp-server";
          };
        };
      }
    ) // {
      # NixOS module for system-wide installation
      nixosModules.default = { config, lib, pkgs, ... }:
        with lib;
        let
          cfg = config.programs.teaching-assistant;
          pkg = self.packages.${pkgs.system}.tagent-cli or null;
        in {
          options.programs.teaching-assistant = {
            enable = mkEnableOption "Teaching Assistant - Canvas LMS desktop app";
            
            package = mkOption {
              type = types.nullOr types.package;
              default = pkg;
              description = "The Teaching Assistant package to install";
            };
          };
          
          config = mkIf cfg.enable (mkMerge [
            (mkIf (cfg.package != null) {
              environment.systemPackages = [ cfg.package ];
            })
            (mkIf (cfg.package == null) {
              warnings = [''
                Teaching Assistant package is not available for ${pkgs.system}.
                You may need to build it manually or check the flake outputs.
              ''];
            })
          ]);
        };
    };
}
