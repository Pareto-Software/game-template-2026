// 🗺️ KENTÄT – each level is a picture made of letters. A maze fits on one
// screen: at most 24 letters wide and 12 rows tall.
//
//   1 2  player 1 and player 2 start here
//   #    wall               B  brick wall          L  locked door (opens with a key 🔑)
//   o    cheese 🧀 (collect all of them to open the exit)
//   *    strawberry 🍓 (bonus points)
//   b    bee 🐝 (wanders)   s  spider 🕷️ (chases)    p  crab 🦀 (walks back and forth)
//   k    key 🔑             P  lightning ⚡ (speed boost)
//   E    exit 🏠
//   (space) empty floor
//
// The letters are defined in config.ts (tiles and things) – add new ones there.

export const levels: string[] = [
  `
########################
#1 o   o  #   o    o  E#
#2 ##### ## ##### #### #
#  o   #    #   o    # #
#### # # ## # ##### # ##
#o   # o  #   b   # o  #
# ## ####### #### #### #
# o    o   #  o      o #
#### ## ## # ###### ## #
#o  o#   o   #    o   o#
#  p    ##  *  ##      #
########################
`,
  `
########################
#1   o   #   o     o   #
#2 #### ## ### ####### #
#  #  o      #   o   # #
# ## ## ####   ### # # #
#o    #  s #o    # #o  #
#### ## ## ####### ## ##
# k   o  #   o   #   o##
# #### ##### ### ## ## #
#o     b    o     #  LL#
#   o     ##  *  o#  LE#
########################
`,
];
