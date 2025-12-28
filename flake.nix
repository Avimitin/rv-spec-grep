{
  description = "RISC-V Spec Grep - Search RISC-V instructions and CSRs";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs_20
            nodePackages.pnpm
            git
          ];

          shellHook = ''
            echo "RISC-V Spec Grep development environment"
            echo "Node.js: $(node --version)"
            echo "pnpm: $(pnpm --version)"
          '';
        };

        packages.default = pkgs.buildNpmPackage {
          pname = "rv-spec-grep";
          version = "0.1.0";
          src = ./.;
          npmDepsHash = "";  # Will be populated after first build

          buildPhase = ''
            pnpm run build
          '';

          installPhase = ''
            cp -r build $out
          '';
        };
      }
    );
}
