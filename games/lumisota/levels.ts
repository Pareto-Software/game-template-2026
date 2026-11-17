// 🗺️ AREENAT – each arena is a top-down picture made of letters. It fits on one
// screen: at most 24 letters wide and 12 rows tall.
//
//   1 2  player 1 and player 2 start here
//   #    snowbank (blocks players and snowballs)
//   T    tree 🌲 (blocks)       B  brick wall 🧱 (blocks)
//   ~    ice (slippery!)
//   S    snowmen come in here   *  power-up 🧤 (super-fast throwing)
//   (space) snowy ground
//
// The letters are defined in config.ts (tiles) – add new ones there.
// After the waves of an arena the game moves to the next one.

export const levels: string[] = [
  `
########################
#S                    S#
#    T          T      #
#      ###  ###        #
#  1    #     #     2  #
#         ~~~~         #
#     T   ~*~~    T    #
#         ~~~~         #
#  ###            ###  #
#      #        #      #
#S        T           S#
########################
`,
  `
########################
#S     #        #     S#
#  T   #   *    #   T  #
#      ###    ###      #
# 1                  2 #
#~~~~    BB  BB    ~~~~#
#~~~~    BB  BB    ~~~~#
#                      #
#      ###    ###      #
#  T   #        #   T  #
#S     #   S    #     S#
########################
`,
];
