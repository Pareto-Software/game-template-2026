// 🗺️ KENTÄT – each level is a picture made of letters.
//
//   1 2  player 1 and player 2 start here
//   #    ground            =  platform you can jump through from below
//   B    brick block       ^  spikes (hurt)        ~  lava (hurts)      I  ice 🧊 (slippery)
//   o    star ⭐           c  candy 🍬            P  power-up 🍭 (double jump)
//   e    snail 🐌 (stomp)  h  frog 🐸 (stomp)     b  bat 🦇 (hurts)
//   T    trampoline 🍄     D  dragon boss 🐉      F  finish flag 🚩
//   (space) empty air
//
// The letters are defined in config.ts (tiles and things) – add new ones there.
// Rows can have different lengths. The bottom row should usually be ground.

export const levels: string[] = [
  `


                                       o o o
                    o o              =======                     F
                  =====                           o   o        ####
          o                  b              ===  ===  ===     #####
  1 2   =====     e                     h                    ######
######################   ######   ##########  ##########################
######################^^^######   ##########~~##########################
`,
  `

                         o  o  o
                        =========            b                          o o
             P                                         o o o           =====   F
           =====     o                  ===         ==========              #####
                    ===      e     T           e                   T       ######
  1 2         o           ######   #     ###########      h      ####      ######
#######   #########   ##########^^^##   #############   ###########################
#######~~~#########~~~##########~~~##~~~#############~~~###########################
`,
  `


                o o o                      o   o   o
              =======        b           =============
       o
     =====         o o            T                 D         F
  1 2           =======    ####  ###                        ####
###################################   ############################
###################################~~~############################
`,
];
