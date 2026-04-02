{
  description = "Teaching Assistant - Nix-native Electron app for Canvas LMS";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
  };

  outputs = inputs@{ flake-parts, nixpkgs, ... }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      systems = [
        "x86_64-linux"
        "aarch64-linux"
      ];

      perSystem = { pkgs, self', system, ... }:
        let
          lib = pkgs.lib;
          electronPkg = pkgs.electron_39 or pkgs.electron;
          cleanedSource = lib.cleanSourceWith {
            src = ./.;
            filter = path: type:
              let
                baseName = builtins.baseNameOf path;
              in
                lib.cleanSourceFilter path type
                && !(builtins.elem baseName [
                  "node_modules"
                  ".direnv"
                  ".git"
                  ".vite"
                  "out"
                ]);
          };
          teachingAssistant = pkgs.buildNpmPackage rec {
            pname = "teaching-assistant";
            version = "1.0.0";

            src = cleanedSource;
            npmDepsHash = "sha256-v4Isp3VjE4JTQe5ZoD5F3thzUbrXy1f4maqNHBta/9o=";

            makeCacheWritable = true;
            npmFlags = [ "--legacy-peer-deps" ];
            dontNpmTest = true;
            ELECTRON_SKIP_BINARY_DOWNLOAD = 1;

            nativeBuildInputs = with pkgs; [
              makeWrapper
              nodejs
              pkg-config
              python3
            ];

            buildPhase = ''
              runHook preBuild

              npm run build:app

              test -f .vite/build/main.js
              test -f .vite/build/preload.js
              test -f .vite/renderer/main_window/index.html

              runHook postBuild
            '';

            installPhase = ''
              runHook preInstall

              app_dir="$out/share/teaching-assistant/app"

              mkdir -p "$out/bin"
              mkdir -p "$app_dir"
              mkdir -p "$out/share/applications"

              cp -r .vite "$app_dir/.vite"
              cp -r mcp-server "$app_dir/mcp-server"

              cat > "$app_dir/package.json" <<'EOF'
              {
                "name": "tagent",
                "productName": "Teaching Assistant",
                "version": "0.1.0",
                "main": ".vite/build/main.js"
              }
EOF

              makeWrapper ${electronPkg}/bin/electron "$out/bin/tagent" \
                --add-flags "$app_dir"

              ln -s "$out/bin/tagent" "$out/bin/ta"

              makeWrapper ${pkgs.nodejs}/bin/node "$out/bin/tagent-mcp" \
                --add-flags "$app_dir/mcp-server/server.mjs"

              cat > "$out/share/applications/tagent.desktop" <<EOF
[Desktop Entry]
Name=Teaching Assistant
Comment=Canvas LMS Teaching Assistant with AI-powered study tools
Exec=$out/bin/tagent
Type=Application
Categories=Education;Utility;
Terminal=false
EOF

              runHook postInstall
            '';

            meta = with lib; {
              description = "Canvas LMS desktop app with AI-powered study tools";
              homepage = "https://github.com/jaren/teaching-assistant";
              license = licenses.mit;
              mainProgram = "tagent";
              platforms = platforms.linux;
            };
          };
        in {
          packages = {
            default = teachingAssistant;
            teaching-assistant = teachingAssistant;
            tagent = teachingAssistant;
          };

          apps = {
            default = {
              type = "app";
              program = "${self'.packages.default}/bin/tagent";
            };
            tagent = {
              type = "app";
              program = "${self'.packages.tagent}/bin/tagent";
            };
          };

          checks = {
            teaching-assistant = teachingAssistant;
          };

          devShells.default = pkgs.mkShell {
            packages = with pkgs; [
              electronPkg
              nodejs
              nodePackages.pnpm
              nodePackages.typescript-language-server
              pkg-config
              python3
            ];

            shellHook = ''
              echo "Teaching Assistant dev shell"
              echo "Run 'npm install' to install dependencies"
              echo "Run 'npm run build:app' to build the production app"
              echo "Run 'npm start' to start the development server"
            '';
          };

          formatter = pkgs.nixfmt-rfc-style;
        };
    };
}
