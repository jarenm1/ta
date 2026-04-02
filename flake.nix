{
  inputs = {
    flake-utils.url = "github:numtide/flake-utils";
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = inputs:
    inputs.flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = (import (inputs.nixpkgs) { inherit system; });
        electronPkg = if pkgs ? electron_41 then pkgs.electron_41 else pkgs.electron;
      in {
        devShells.default = pkgs.mkShell {
          packages = [
            pkgs.nodejs
            pkgs.nodePackages.pnpm
            pkgs.nodePackages.typescript-language-server
            electronPkg
          ];

          ELECTRON_OVERRIDE_DIST_PATH = "${electronPkg}/bin";
          NIX_ELECTRON_DIST = "${electronPkg}/bin";
        };
      }
    );
}
