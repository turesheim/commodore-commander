The launchers in bin are intended to be invoked from a terminal, and make
visible the log output that is hidden when lanching the .app versions.

From macOS 10.15 (Catalina) onwards, double clicking these in Finder
will not initially work due to not being able to codesign a shell script.
But after trying, you can open the 'Security & Privacy' section of System
Preferences and there will be an 'Open Anyway' button that allows it.
