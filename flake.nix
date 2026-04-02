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
        
        # Build using buildNpmPackage
        teaching-assistant = pkgs.buildNpmPackage rec {
          pname = "teaching-assistant";
          version = "1.0.0";
          
          src = ./.;
          
          npmDepsHash = "sha256-9cIkukNpsJexuoD8aZ55frBEIHupz07kxZqLbkcNYIo=";
          
          nativeBuildInputs = with pkgs; [
            nodejs
            python3
            makeWrapper
            pkg-config
          ];
          
          buildInputs = with pkgs; [
            electronPkg
            nodejs  # For MCP server
          ];
          
          # Skip npm audit for purity
          npmFlags = [ "--legacy-peer-deps" ];
          
          # Don't run tests during build
          dontNpmTest = true;
          
          # Environment variables for build
          ELECTRON_SKIP_BINARY_DOWNLOAD = 1;
          ELECTRON_OVERRIDE_DIST_PATH = "${electronPkg}/bin";
          
          buildPhase = ''
            runHook preBuild
            
            # Build the app with electron-forge
            npm run package
            
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
            
            # Copy the packaged app
            cp -r out/*-unpacked/* $out/share/teaching-assistant/ 2>/dev/null || cp -r .vite/build/* $out/share/teaching-assistant/ 2>/dev/null || true
            
            # Create wrapper for main app
            makeWrapper ${electronPkg}/bin/electron $out/bin/tagent \
              --add-flags "$out/share/teaching-assistant" \
              --set ELECTRON_OVERRIDE_DIST_PATH "${electronPkg}/bin"
            
            # Create 'ta' symlink as shorthand
            ln -s $out/bin/tagent $out/bin/ta
            
            # Create wrapper for MCP server
            makeWrapper ${pkgs.nodejs}/bin/node $out/bin/tagent-mcp \
              --add-flags "$out/lib/node_modules/tagent/mcp-server/server.mjs"
            
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
          '';
          
          meta = with pkgs.lib; {
            description = "Teaching Assistant - Canvas LMS desktop app";
            homepage = "https://github.com/jaren/teaching-assistant";
            license = licenses.mit;
            maintainers = [ ];
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
          '';
        };
        
        # Package output
        packages = {
          default = teaching-assistant;
          tagent = teaching-assistant;
          teaching-assistant = teaching-assistant;
        };
        
        # App output for direct installation
        apps = {
          default = {
            type = "app";
            program = "${teaching-assistant}/bin/tagent";
          };
          tagent = {
            type = "app";
            program = "${teaching-assistant}/bin/tagent";
          };
          tagent-mcp = {
            type = "app";
            program = "${teaching-assistant}/bin/tagent-mcp";
          };
        };
      }
    ) // {
      # NixOS module for system-wide installation
      nixosModules.default = { config, lib, pkgs, ... }:
        with lib;
        let
          cfg = config.programs.teaching-assistant;
          pkg = self.packages.${pkgs.system}.teaching-assistant or null;
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
