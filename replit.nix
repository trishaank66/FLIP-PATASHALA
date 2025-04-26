{pkgs}: {
  deps = [
    pkgs.jq
    pkgs.glibcLocales
    pkgs.python311Packages.numpy
    pkgs.python311Packages.pandas
    pkgs.postgresql
  ];
}
