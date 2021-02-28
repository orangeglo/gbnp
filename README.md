# GBNP: Game Boy Nintendo Power ROM Builder

![GBNP logo](img/gbnp.png)

This tool can build the data necessary to flash new games to a [Nintendo Power Game Boy cart](https://en.wikipedia.org/wiki/Nintendo_Power_(cartridge)). The cartridge can store up to seven roms, or a total of 896KB of game data. For flashing, I recommend the [GBxCart](https://www.gbxcart.com/).

## Features
- Original menu built in, no need to provide ROM
- Add up to seven games depending on their sizes
- Four different font options for menu entry, including a JP font similar to the original
- Load data from a previously created rom
- Built in romhack options, including an english translation patch
- Generate single rom MAP files for 1MB games

## Credits
- GB Memory Maker: https://github.com/Infinest/GB-Memory-Binary-Maker
  - Without this source, this project would have been much more difficult!
- NesDev Forum Thread: http://forums.nesdev.com/viewtopic.php?f=12&t=11453
- Early GameBoy Font: https://www.dafont.com/early-gameboy.font
- Pokemon GB Font: https://www.fontspace.com/pokemon-gb-font-f9621
- Nokia Cellphone FC Font: https://www.dafont.com/nokia-cellphone.font
- NP GBメモリ (DMG-MMUS) Font
  - This is an attempt at reproducing the original font used on the GB Memory cartridge. Since the font is not stored in the rom, "Lesserkuma" has been working to recreate the font by studying cartridge dumps. The font started life as the one used in the JP Game Boy game "Kaeru no Tame ni Kane wa Naru", and has been tweaked to closly resemble the original GB Memory font! Special thanks to "Lesserkuma" for their hard work!
