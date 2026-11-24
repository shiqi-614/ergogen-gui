import {ConfigExample} from "./index";

const ErgoCai : ConfigExample = {
    label: "ErgoCai",
    author: "jinsongc",
    value: `
units:
  kx: u
  ky: u
  screwSize: 1.05
  studSize: 1.75
  # the funnels through the case wall in front of the power switch and the USB port (usb_and_swith): half width
  # where they start, half width at the far end, and how far out the far end is. The start is as wide as the
  # switchplate's cut-outs for the two parts (the Dwgs.User rectangles in their footprints, 11.2 mm), so the
  # sides of those openings run straight on into the funnels.
  funnelNarrow: 5.6
  funnelWide: 25
  funnelDepth: 10
  # How far out from the board edge the funnels start, in every case part. The gap part is only a frame around
  # the board, and this strip of it between the board and the funnels holds the frame together.
  funnelLip: 2
  # The tenting legs (outlines _tent_*, cases *_tent_*, assemblies *_tent_*): under each half's two inner screws a
  # printed seat with two 3 mm acrylic legs on one pin, one for each angle, tentLow and tentHigh degrees. A ball
  # plunger behind each leg holds it folded flat toward the half's middle, or standing (ErgoCai.modules tent/tent.js,
  # whose numbers these repeat). By its outer edge the half stands on two bought silicone bumpers.
  tentLow: 10
  tentHigh: 15
  # The seats' height under the plate; the pin's place from a seat's screw, along the legs and under the plate; the
  # legs' width, a round end of half that round the pin, and their pin's hole; each leg's slot, beside the screw
  # (toward -y on the seat at matrix_top_left, +y on the mirrored one at thumb_lower)
  tentSeat: 8.6
  tentPivotX: 6.5
  tentPivotZ: 3.4
  tentLegW: 6
  tentLegT: 3
  tentPin: 2.2
  tentSlotLow: 6.5
  tentSlotHigh: 11.5
  # The detent: the plunger's 1.5 mm ball (radius tentBall) rests on the edges of a notch in the leg's round end, the
  # folded one where the end points at the plunger and the standing one a quarter turn on. A notch is tentNotch* wide
  # each side of its middle where it meets the round end, and round, 0.05 mm wider still, so that its bottom is clear
  # of the ball; its middle is tentNotch*At from the pin. The standing one is wider, the ball up to 0.35 mm into it
  # against 0.2 mm folded: folding the leg takes more than unfolding it. Each is tentRest degrees past where the leg
  # stops, so that the ball keeps the leg there: folded, up against the plate; standing, back on its slot's end.
  tentBall: 0.75
  tentNotchFold: 0.47
  tentNotchOpen: 0.6
  tentNotchFoldAt: sqrt(tentLegW * tentLegW / 4 - tentNotchFold * tentNotchFold) + sqrt(0.1 * tentNotchFold + 0.0025)
  tentNotchOpenAt: sqrt(tentLegW * tentLegW / 4 - tentNotchOpen * tentNotchOpen) + sqrt(0.1 * tentNotchOpen + 0.0025)
  tentRest: 1
  # The bumpers (assemblies *_tent_*: tent-bumper-*), domes tentBumperD across and tentBumper high, flush with the
  # straight outer edge; the half tilts on the line through their middles
  tentBumperD: 8
  tentBumper: 2.5
  tentBumperDome: (tentBumperD * tentBumperD / 4 + tentBumper * tentBumper) / (2 * tentBumper)
  # How far each seat's pin is from that line (x 138.04 on the right half): matrix_top_left's at x -28.65;
  # thumb_lower's at -26.87 less its slot times sin 25 degrees, the seat being turned with the thumbs. From ergogen's
  # points: move them with the screws.
  tentReachTop: 166.69
  tentReachThumb: 164.91
  # A leg's length, from the pin to its foot's middle: how deep the table is under the plate there, tilted by the
  # angle and touching the bumpers' domes, less the pin's depth. Its foot is cut along the table: its -y edge (the
  # raised side's, standing) longer by the bevel, the table's slope across the leg's width (on the thumb seat, turned
  # 25 degrees, times cos 25 degrees). There the table slopes across the leg's thickness too, and the foot's edge
  # nearer the bumpers is the one on it.
  tentTopLow: tentBumper + tentBumperDome * (1 / cos(tentLow deg) - 1) + tentReachTop * tan(tentLow deg) - tentPivotZ
  tentTopHigh: tentBumper + tentBumperDome * (1 / cos(tentHigh deg) - 1) + tentReachTop * tan(tentHigh deg) - tentPivotZ
  tentThumbLow: tentBumper + tentBumperDome * (1 / cos(tentLow deg) - 1) + (tentReachThumb + (tentSlotLow - tentLegT / 2) * sin(25 deg)) * tan(tentLow deg) - tentPivotZ
  tentThumbHigh: tentBumper + tentBumperDome * (1 / cos(tentHigh deg) - 1) + (tentReachThumb + (tentSlotHigh - tentLegT / 2) * sin(25 deg)) * tan(tentHigh deg) - tentPivotZ
  tentBevelTopLow: tentLegW * tan(tentLow deg)
  tentBevelTopHigh: tentLegW * tan(tentHigh deg)
  tentBevelThumbLow: tentLegW * tan(tentLow deg) * cos(25 deg)
  tentBevelThumbHigh: tentLegW * tan(tentHigh deg) * cos(25 deg)
  # For the cases that show the legs folded and standing: a leg laid flat is turned about its own middle, so each
  # is shifted back by the distance from its pin to that middle (from its round end to its foot's long corner)
  tentMidTopLow: (tentTopLow + tentBevelTopLow / 2 - tentLegW / 2) / 2
  tentMidTopHigh: (tentTopHigh + tentBevelTopHigh / 2 - tentLegW / 2) / 2
  tentMidThumbLow: (tentThumbLow + tentBevelThumbLow / 2 - tentLegW / 2) / 2
  tentMidThumbHigh: (tentThumbHigh + tentBevelThumbHigh / 2 - tentLegW / 2) / 2
  # the pins' height in the cases of a standing pair, whose lower foot is that case's bottom
  tentOpenLow: max(tentTopLow + tentBevelTopLow / 2, tentThumbLow + tentBevelThumbLow / 2)
  tentOpenHigh: max(tentTopHigh + tentBevelTopHigh / 2, tentThumbHigh + tentBevelThumbHigh / 2)
points:
  zones:
    matrix:
      columns: 
        col0: 
          key:
            stagger: -2.5
          rows.row4.skip: true
          rows.row2.skip: true
          rows.row1:
            width: 1.5kx
            rotate: 90
            shift: [0, -0.255kx]
          rows.row3:
            width: 1.5kx
            rotate: 90
            shift: [0, 0.24kx]
        col1:
          key:
            stagger: 0
          rows.row4.skip: true 
        col2:
          key:
            stagger: 2.5
          rows.row4.asym: clone 
        col3:
          key:
            stagger: 2.5
          rows.row4.asym: clone 
        col4:
          key:  
            stagger: -2.5
        col5:
          key:
            stagger: -2.5
        col6:
          key:
            width: 1.5kx
            shift: [0.255kx, 0]
          rows:
            row4:
              width: 1kx
              shift: [0, 0]
      rows:
        row4:
        row3:
        row2:
        row1:
        row0:
    thumbs:
      anchor:
        ref: matrix_col1_row4
        shift: [-2.37kx, -2.2kx]
        rotate: 25
      columns: 
        col0: 
          key.column_net: col5
          rows: 
            row5:  
              shift: [0kx, 1kx] 
        col1:
          key.column_net: col6
          rows: 
            row5:   
              shift: [-1kx, -0kx]  
 
        col2:
          key.column_net: col4
          rows: 
            row5:  
              width: 2kx
              rotate: 90
              shift: [-1kx, 0.5kx]   
        col3:
          key.column_net: col3
          rows:  
            row5:  
              width: 2kx 
              rotate: 90 
              shift: [-0.9kx, 0.5kx] 
      rows:
        row5:

  mirror: &mirror
    ref: thumbs_col0_row5
    distance: -2kx

outlines:
  # One funnel shape (units funnelNarrow, funnelWide, funnelDepth), starting funnelLip out from the board edge in
  # front of each part. The two are added, not stacked: their far ends overlap, and stacked they'd merge into one
  # open line.
  usb_and_swith:
    # the power switch, on the board tab that ends at 1ky + 5
    - what: polygon
      operation: add
      points:
        - ref: matrix_col1_row0
          shift: [-9.5 + funnelWide, 1ky + 5 + funnelLip + funnelDepth]
        - ref: matrix_col1_row0
          shift: [-9.5 + funnelNarrow, 1ky + 5 + funnelLip]
        - ref: matrix_col1_row0
          shift: [-9.5 - funnelNarrow, 1ky + 5 + funnelLip]
        - ref: matrix_col1_row0
          shift: [-9.5 - funnelWide, 1ky + 5 + funnelLip + funnelDepth]
    # the USB port, on the board tab that ends at 1ky
    - what: polygon
      operation: add
      points:
        - ref: matrix_col3_row0
          shift: [funnelWide, 1ky + funnelLip + funnelDepth]
        - ref: matrix_col3_row0
          shift: [funnelNarrow, 1ky + funnelLip]
        - ref: matrix_col3_row0
          shift: [-funnelNarrow, 1ky + funnelLip]
        - ref: matrix_col3_row0
          shift: [-funnelWide, 1ky + funnelLip + funnelDepth]
  cut:
    - what: polygon
      operation: stack
      points:
        - ref: matrix_col6_row0
          shift: [0.8kx, 1ky + 11]
        - ref: matrix_col1_row0
          shift: [-2.7kx, 1ky + 11]
        - ref: matrix_col1_row0
          shift: [-2.7kx, 1ky + 15]
        - ref: matrix_col6_row0
          shift: [0.8kx, 1ky + 15]

  board:
    - what: polygon
      operation: stack
      points:
        - ref: matrix_col6_row0
          shift: [0.8kx, 1ky + 3]
        - ref: matrix_col3_row0
          shift: [0.3kx, 1ky - 2]
        - ref: matrix_col3_row0
          shift: [0.3kx, 1ky]
        - ref: matrix_col3_row0
          shift: [-0.3kx, 1ky]
        - ref: matrix_col3_row0
          shift: [-0.3kx, 1ky - 2]
        - ref: matrix_col1_row0
          shift: [-0.15kx, 1ky + 3]
        - ref: matrix_col1_row0
          shift: [-0.15kx, 1ky + 5]
        - ref: matrix_col1_row0
          shift: [-0.85kx, 1ky + 5]
        - ref: matrix_col1_row0
          shift: [-0.85kx, 1ky + 3]
        - ref: matrix_col1_row0
          shift: [-2.75kx, 1ky + 3]
        - ref: matrix_col1_row0
          shift: [-2.75kx, -4.53ky]
        - ref: thumbs_col0_row5
          shift: [-0.65kx, 0.65ky]
        - ref: thumbs_col1_row5
          shift: [-0.65kx, -0.65ky]
        - ref: matrix_col6_row0
          shift: [-2.8kx, -4.7ky]
        - ref: matrix_col6_row0
          shift: [0.8kx , -4.7ky]
      fillet: 0.9

  # where the case parts are screwed together
  _shell_mounts:
    $params: [__what__, __radius__]
    matrix_top_right:
      what: __what__
      radius: __radius__
      where:
        ref: [matrix_col6_row0]
        shift: [0.95kx, 1.25ky]
    matrix_top_left:
      what: __what__
      radius: __radius__
      where:
        ref: [matrix_col0_row0]
        shift: [-1.85kx, 1.25ky]
    matrix_bottom_right:
      what: __what__
      radius: __radius__
      where:
        ref: [matrix_col6_row4]
        shift: [1.2kx, -0.84ky]
    matrix_bottom_left:
      what: __what__
      radius: __radius__
      where:
        ref: [matrix_col6_row4]
        shift: [-2.48kx, -0.9ky]
    thumb_upper:
      what: __what__
      radius: __radius__
      where:
        ref: [thumbs_col0_row5]
        shift: [-0.8kx, 0.75ky]
    thumb_lower:
      what: __what__
      radius: __radius__
      where:
        ref: [thumbs_col1_row5]
        shift: [-0.75kx, -0.77ky]
  stud_mounting:
    $extends: outlines._shell_mounts
    $args: [hexagon, studSize]
  screw_mounting:
    $extends: outlines._shell_mounts
    $args: [circle, screwSize]

  expand:
    - name: board
      expand: 8

  combo:
    - name: expand
    - operation: subtract
      name: stud_mounting

  # A tenting leg laid flat, its pin's hole where the pin is: __ref__ shifted [__sx__, __sy__] is its seat's screw (as
  # in _shell_mounts), __slot__ the leg's slot (+-y from the screw), __turn__ undoes the screw's point's turn so that
  # the leg lies along x, as it folds; __length__ from the pin to the foot's middle, __bevel__ how much longer its
  # -y edge is than its +y one (units tent*). The notches for the plunger's ball (units tentNotch*, tentRest): fold
  # where the round end points at the plunger, folded; open where the -y edge starts, which is on the plunger's side
  # standing.
  _tent_leg:
    $params: [__ref__, __sx__, __sy__, __slot__, __turn__, __length__, __bevel__]
    body:
      what: polygon
      where: {ref: __ref__, shift: [__sx__, __sy__]}
      adjust: {shift: [tentPivotX, __slot__], rotate: __turn__}
      points:
        - shift: [0, -tentLegW / 2]
        - shift: [__length__ + __bevel__ / 2, 0]
        - shift: [-(__bevel__), tentLegW]
        - shift: [-(__length__ - __bevel__ / 2), 0]
    end:
      what: circle
      where: {ref: __ref__, shift: [__sx__, __sy__]}
      adjust: {shift: [tentPivotX, __slot__], rotate: __turn__}
      radius: tentLegW / 2
    pin:
      what: circle
      operation: subtract
      where: {ref: __ref__, shift: [__sx__, __sy__]}
      adjust: {shift: [tentPivotX, __slot__], rotate: __turn__}
      radius: tentPin / 2
    fold:
      what: circle
      operation: subtract
      where: {ref: __ref__, shift: [__sx__, __sy__]}
      adjust: [{shift: [tentPivotX, __slot__], rotate: __turn__}, {orient: 180 - tentRest, shift: [tentNotchFoldAt, 0]}]
      radius: tentNotchFold + 0.05
    open:
      what: circle
      operation: subtract
      where: {ref: __ref__, shift: [__sx__, __sy__]}
      adjust: [{shift: [tentPivotX, __slot__], rotate: __turn__}, {orient: 270 + tentRest, shift: [tentNotchOpenAt, 0]}]
      radius: tentNotchOpen + 0.05
  # the right half's legs on their seats: matrix_top_left's, and thumb_lower's, turned 25 degrees with the thumbs
  _tent_top_low:
    $extends: outlines._tent_leg
    $args: [matrix_col0_row0, -1.85kx, 1.25ky, -tentSlotLow, 0, tentTopLow, tentBevelTopLow]
  _tent_top_high:
    $extends: outlines._tent_leg
    $args: [matrix_col0_row0, -1.85kx, 1.25ky, -tentSlotHigh, 0, tentTopHigh, tentBevelTopHigh]
  _tent_thumb_low:
    $extends: outlines._tent_leg
    $args: [thumbs_col1_row5, -0.75kx, -0.77ky, tentSlotLow, -25, tentThumbLow, tentBevelThumbLow]
  _tent_thumb_high:
    $extends: outlines._tent_leg
    $args: [thumbs_col1_row5, -0.75kx, -0.77ky, tentSlotHigh, -25, tentThumbHigh, tentBevelThumbHigh]
  # The legs to cut from the case's 3 mm acrylic, side by side, the pins' holes on a line: two of each for a keyboard
  # (the left half's are the same, turned over). From the top: matrix_top_left's low and high, thumb_lower's low and
  # high
  tent_legs:
    - what: outline
      name: _tent_top_low
      origin: [{ref: matrix_col0_row0, shift: [-1.85kx, 1.25ky]}, {shift: [tentPivotX, -tentSlotLow]}]
    - what: outline
      name: _tent_top_high
      origin: [{ref: matrix_col0_row0, shift: [-1.85kx, 1.25ky]}, {shift: [tentPivotX, -tentSlotHigh]}]
      where: {shift: [0, -10]}
    - what: outline
      name: _tent_thumb_low
      origin: [{ref: thumbs_col1_row5, shift: [-0.75kx, -0.77ky]}, {shift: [tentPivotX, tentSlotLow], rotate: -25}]
      where: {shift: [0, -20]}
    - what: outline
      name: _tent_thumb_high
      origin: [{ref: thumbs_col1_row5, shift: [-0.75kx, -0.77ky]}, {shift: [tentPivotX, tentSlotHigh], rotate: -25}]
      where: {shift: [0, -30]}

  
  
pcbs:
  ergo_cai_right: 
    outlines:
      main:
        outline: board
    footprints:
      keys1:
        what: 
          github:
            repo: "shiqi-614/ErgoCaiLib"
            file: "footprints/ErgoCai.pretty/SW_MX_HS_CPG151101S11_1u.kicad_mod"
        where: true
      keys2:
        what: 
          github:
            repo: "shiqi-614/ErgoCaiLib"
            file: "footprints/ErgoCai.pretty/SW_MX_HS_CPG151101S11_1.5u.kicad_mod"
        where: [matrix_col0_row1, matrix_col0_row3, matrix_col6_row0, matrix_col6_row1, matrix_col6_row2, matrix_col6_row3]
      keys3:
        what: 
          github:
            repo: "shiqi-614/ErgoCaiLib"
            file: "footprints/ErgoCai.pretty/SW_MX_HS_CPG151101S11_2u.kicad_mod"
        where: [thumbs_col2_row5, thumbs_col3_row5]
      diodes:
        what: 
          github:
            repo: "shiqi-614/ErgoCaiLib"
            file: "footprints/ErgoCai.pretty/Diode-Dual.kicad_mod"
        where: true
        adjust:
          shift: [0, -8.4]
          rotate: 180
        side: back
      stab: 
        what: 
          github:
            repo: "shiqi-614/ErgoCaiLib"
            file: "footprints/ErgoCai.pretty/STAB_MX_2u.kicad_mod"
        where: [thumbs_col2_row5, thumbs_col3_row5]
    modules:
      charger:
        what:
          github:
            repo: "shiqi-614/ErgoCai.modules"
            file: "battery/BQ24072_charger/BQ24072_charger.kicad_pcb"
        where:
          ref: [matrix_col0_row0]
          # 4 mm toward the keys, clear of the pouch cell connector's pins
          shift: [-13, 16]
          rotate: -90
        side: back
      battery:
        what:
          github:
            repo: "shiqi-614/ErgoCai.modules"
            file: "battery/18650_Nickel/18650_Nickel.kicad_pcb"
        where:
          ref: [matrix_col0_row0]
          shift: [-24, -31.5]
          rotate: 0
      # A pouch LiPo's connector, for a cell in the battery opening instead of the 18650 (fit one or the other). It
      # is on the holder's axis, its entry facing the holder's end and its courtyard 0.5 mm past the holder's, so the
      # cell's plug goes in from the opening, which the connector's cut-out in the switchplate joins.
      jst-ph-battery-backup:
        what:
          github:
            repo: "shiqi-614/ErgoCai.modules"
            file: "battery/JST_PH_P2.00mm/JST_PH_P2.00mm.kicad_pcb"
        where:
          ref: [matrix_col0_row0]
          shift: [-24, 11]
          rotate: 0
      e-paper:
        what: 
          github:
            repo: "shiqi-614/ErgoCai.modules"
            file: "e-paper/2.13inch-socket/2.13inch-socket.kicad_pcb"
        where:
          ref: [matrix_col0_row0]
          shift: [-24, -31.5]
          rotate: -0
      power_switch:
        what:
          github:
            repo: "shiqi-614/ErgoCai.modules"
            file: "battery/power_switch_right/power_switch_right.kicad_pcb"
        where:
          ref: matrix_col1_row0
          shift: [-9.5, 21.5]
        asym: source
      power_switch-left:
        what:
          github:
            repo: "shiqi-614/ErgoCai.modules"
            file: "battery/power_switch_right/power_switch_right.kicad_pcb"
        where:
          ref: matrix_col1_row0
          shift: [-9.5, 21.5]
        asym: clone
      # the joystick module, or the trackball module in its place, by the six pogo pins on its back, on the mount's
      # contact pads JOYSTICK_P1 (joystick-mount/joystick-mount.kicad_pcb: the joystick by its 6P FFC instead)
      joystick: 
        what: 
          github:
            repo: "shiqi-614/ErgoCai.modules"
            file: "joystick/joystick-mount-pogo/joystick-mount-pogo.kicad_pcb"
        where: 
          ref: [thumbs_col3_row5]
          # (-9, 2 mm further out than -7: the mount's courtyard 0.1 mm inside the board's edge, 2 mm further
          # from the key matrix)
          shift: [-9, -30]
          rotate: -90
        asym: source
      usb:
        what: 
          github:
            repo: "shiqi-614/ErgoCai.modules"
            file: "usb/default_usb/default_usb.kicad_pcb"
        where:
          ref: [matrix_col3_row0]
          shift: [-0, 16.3] 
      mcu:
        what:  
          github: 
            repo: "shiqi-614/ErgoCai.modules"
            file: "mcu/E73-2G4M08S1C/E73-2G4M08S1C.kicad_pcb"
        where:
          ref: matrix_col0_row0
          shift: [-24, -25.5]
          rotate: 90 
      reset:
        what: 
          github: 
            repo: "shiqi-614/ErgoCai.modules"
            file: "reset/reset/reset.kicad_pcb"
        where: 
          ref: [matrix_col0_row0]
          shift: [-12, -72]
          rotate: 180
        asym: source
  
      reset-left:
        what: 
          github: 
            repo: "shiqi-614/ErgoCai.modules"
            file: "reset/reset/reset.kicad_pcb"
        where: 
          ref: [matrix_col0_row0]
          shift: [-12, -72]
          rotate: 0
        asym: clone
  ergo_cai_left:
    mirror:
      from: ergo_cai_right
  # The right half with the trackball on the keyboard board itself (ErgoCai.modules trackball/PMW3610): the sensor
  # flat on its back, its lens up through the board, in the pogo mount's place, no module board and no pogo pins;
  # its ball seat snaps under the case's top layer as the pogo modules' cartridges do, so the case is the joystick's
  ergo_cai_right_trackball:
    $extends: pcbs.ergo_cai_right
    modules:
      joystick:
        what:
          github:
            repo: "shiqi-614/ErgoCai.modules"
            file: "trackball/PMW3610/PMW3610.kicad_pcb"
        where:
          ref: [thumbs_col3_row5]
          shift: [-9, -30]
          # turned half a turn from the mount, as the pogo trackball module is on it
          rotate: 90

cases:  
  right_top:
    - what: outline
      name: expand
      extrude: 3
    - what: outline
      name: screw_mounting
      extrude: 3
      operation: subtract
    - what: outline
      name: cut
      extrude: 3
      operation: subtract
    - what: pcb
      name: /footprints.keys/
      extrude: 3
      operation: subtract
      expand: 0.5
      layers: [Dwgs.User]
      asym: source
    - what: pcb
      name: /modules.battery/
      extrude: 3
      operation: subtract
      expand: 0.5
    - what: pcb
      # the pogo mount's courtyard, for the joystick or the trackball read from above (right_top_side opens it further
      # for the side-read trackball, as right_middle_side and right_switchplate_side do the middle and switch plates)
      name: /modules.joystick/
      extrude: 3
      operation: subtract
      expand: 1.5
    - what: pcb
      name: /footprints.stab/
      expand: 0.5
      extrude: 3
      operation: subtract
      layers: [Dwgs.User]
    - what: pcb
      name: /modules.e-paper.EPM_H/
      extrude: 3
      operation: subtract
      layers: ["*.Cu"]

  right_middle:
    - what: outline
      name: combo
      extrude: 5
    - what: pcb
      name: /footprints.keys/
      extrude: 5
      operation: subtract
      expand: 0.5
      layers: [Dwgs.User]
    - what: pcb
      name: /footprints.stab/
      extrude: 5
      expand: 0.5
      operation: subtract
      layers: [Dwgs.User]
    - what: pcb
      name: /modules.(charger|battery)/
      extrude: 5
      operation: subtract
      expand: 0.5
    - what: pcb
      name: /modules.battery/
      extrude: 5
      operation: subtract
      expand: 0.5
      shift: [5, 0, 0]
    # 1 mm wider than right_top's: the edge of right_top's opening is the ledge the joystick retainer's hooks
    # catch under (ErgoCai.modules joystick/Alpsalpine-pogo/retainer)
    - what: pcb
      name: /modules.joystick/
      extrude: 5
      operation: subtract
      expand: 2.5
    - what: outline
      name: usb_and_swith
      extrude: 5
      operation: subtract
    - what: pcb
      expand: 1
      name: /modules.e-paper.EPM_H/
      extrude: 5
      operation: subtract
      layers: ["*.Cu"]
    # the e-paper FFC's way down to the slot in the board, in front of its socket on the back
    - what: pcb
      name: /modules.e-paper.EPM_FPC1/
      extrude: 5
      operation: subtract
      expand: 0.5
      layers: [Dwgs.User]
      side: back

  right_switchplate:
    - what: outline
      name: combo
      extrude: 5
    # the switches' plate cut-out, drawn on Eco2.User in their footprints: the 14 mm square, and room for the two
    # latches, which reach 0.5 mm past it
    - what: pcb
      name: /footprints.keys[12]/
      extrude: 5
      operation: subtract
      layers: [Eco2.User]
    - what: pcb
      name: /footprints.keys3/
      extrude: 5
      operation: subtract
      layers: [Dwgs.User]
    - what: pcb
      name: /footprints.stab/
      extrude: 5
      operation: subtract
      layers: [Dwgs.User]
    - what: pcb
      name: /modules.(charger|battery|jst-ph-battery-backup)/
      extrude: 5
      operation: subtract
      expand: 0.5
    - what: pcb
      name: /modules.joystick/
      extrude: 5
      operation: subtract
      expand: 1.5
    - what: outline
      name: usb_and_swith
      extrude: 5
      operation: subtract
    # the power switch and the USB receptacle, with the room the lever and the plug need: drawn on Dwgs.User in
    # their footprints, over the whole part
    - what: pcb
      name: /modules.(usb.USB_J1|power_switch(-left)?.BAT_SW1)/
      extrude: 5
      operation: subtract
      layers: [Dwgs.User]
    - what: pcb
      name: /modules.e-paper.EPM_FPC1/
      extrude: 5
      operation: subtract
      expand: 0.5
      layers: [Dwgs.User]
      side: back

  right_gap: 
    - what: outline
      name: expand
      extrude: 5
    - what: outline
      name: board
      extrude: 5
      operation: subtract
    - what: outline
      name: usb_and_swith
      extrude: 5
      operation: subtract
    - what: outline
      name: stud_mounting
      extrude: 5
      operation: subtract

  right_buttom:
    - what: outline
      name: expand
      extrude: 3
    - what: outline
      name: screw_mounting
      extrude: 3
      operation: subtract
    - what: outline
      name: usb_and_swith
      extrude: 3
      operation: subtract
    # the reset button's hole, under its plunger: drawn on Dwgs.User in its footprint, on the board's back, so it
    # goes where the module does
    - what: pcb
      name: /modules.reset(-left)?.RESRT_SW1/
      extrude: 3
      operation: subtract
      layers: [Dwgs.User]
      side: back

  # The same case for the side-read trackball (ErgoCai.modules trackball/PMW3610-side-pogo) on the mount: each layer
  # the joystick's, opened further round the mount's User.1 outline (the side module's board and ball seat)
  right_top_side:
    - what: case
      name: right_top
    - what: pcb
      name: /modules.joystick/
      extrude: 3
      operation: subtract
      expand: 1.5
      layers: [User.1]
      cut: outline
  right_middle_side:
    - what: case
      name: right_middle
    - what: pcb
      name: /modules.joystick/
      extrude: 5
      operation: subtract
      expand: 2.5
      layers: [User.1]
      cut: outline
  right_switchplate_side:
    - what: case
      name: right_switchplate
    - what: pcb
      name: /modules.joystick/
      extrude: 5
      operation: subtract
      expand: 1.5
      layers: [User.1]
      cut: outline

  left_top:
    mirror:
      from: right_top

  left_middle:
    mirror:
      from: right_middle

  left_switchplate:
    mirror:
      from: right_switchplate

  left_gap:
    mirror:
      from: right_gap

  left_buttom:
    mirror:
      from: right_buttom

  # The tenting legs under the bottom plate, for the tent assemblies: each leg (outlines._tent_*) laid flat, turned on
  # its edge and along its slot (rotate, about the leg's middle), and shifted so that its hole is on its seat's pin
  # (units tent*), the case's bottom at its lowest point. Folded, all four lie toward the half's middle, the pins
  # tentLegW / 2 over the case's bottom; in right_tent_low and right_tent_high that pair stands square to the plate,
  # its lower foot the bottom, and the other pair stays folded.
  right_tent_folded:
    - what: outline
      name: _tent_top_low
      extrude: tentLegT
      rotate: [90, 0, 0]
      shift: [0, tentLegT / 2, tentLegW / 2]
    - what: outline
      name: _tent_top_high
      extrude: tentLegT
      rotate: [90, 0, 0]
      shift: [0, tentLegT / 2, tentLegW / 2]
    - what: outline
      name: _tent_thumb_low
      extrude: tentLegT
      rotate: [90, 0, 25]
      shift: [-tentMidThumbLow * (1 - cos(25 deg)) - tentLegT / 2 * sin(25 deg), tentLegT / 2 * cos(25 deg) + tentMidThumbLow * sin(25 deg), tentLegW / 2]
    - what: outline
      name: _tent_thumb_high
      extrude: tentLegT
      rotate: [90, 0, 25]
      shift: [-tentMidThumbHigh * (1 - cos(25 deg)) - tentLegT / 2 * sin(25 deg), tentLegT / 2 * cos(25 deg) + tentMidThumbHigh * sin(25 deg), tentLegW / 2]
  right_tent_low:
    - what: outline
      name: _tent_top_low
      extrude: tentLegT
      rotate: [90, 90, 0]
      shift: [-tentMidTopLow, tentLegT / 2, tentOpenLow - tentMidTopLow]
    - what: outline
      name: _tent_top_high
      extrude: tentLegT
      rotate: [90, 0, 0]
      shift: [0, tentLegT / 2, tentOpenLow]
    - what: outline
      name: _tent_thumb_low
      extrude: tentLegT
      rotate: [90, 90, 25]
      shift: [-tentMidThumbLow - tentLegT / 2 * sin(25 deg), tentLegT / 2 * cos(25 deg), tentOpenLow - tentMidThumbLow]
    - what: outline
      name: _tent_thumb_high
      extrude: tentLegT
      rotate: [90, 0, 25]
      shift: [-tentMidThumbHigh * (1 - cos(25 deg)) - tentLegT / 2 * sin(25 deg), tentLegT / 2 * cos(25 deg) + tentMidThumbHigh * sin(25 deg), tentOpenLow]
  right_tent_high:
    - what: outline
      name: _tent_top_low
      extrude: tentLegT
      rotate: [90, 0, 0]
      shift: [0, tentLegT / 2, tentOpenHigh]
    - what: outline
      name: _tent_top_high
      extrude: tentLegT
      rotate: [90, 90, 0]
      shift: [-tentMidTopHigh, tentLegT / 2, tentOpenHigh - tentMidTopHigh]
    - what: outline
      name: _tent_thumb_low
      extrude: tentLegT
      rotate: [90, 0, 25]
      shift: [-tentMidThumbLow * (1 - cos(25 deg)) - tentLegT / 2 * sin(25 deg), tentLegT / 2 * cos(25 deg) + tentMidThumbLow * sin(25 deg), tentOpenHigh]
    - what: outline
      name: _tent_thumb_high
      extrude: tentLegT
      rotate: [90, 90, 25]
      shift: [-tentMidThumbHigh - tentLegT / 2 * sin(25 deg), tentLegT / 2 * cos(25 deg), tentOpenHigh - tentMidThumbHigh]
  left_tent_folded:
    mirror:
      from: right_tent_folded
  left_tent_low:
    mirror:
      from: right_tent_low
  left_tent_high:
    mirror:
      from: right_tent_high

# How the case parts stack up around each board, from the bottom up, for the 3D board preview: each part sits on
# the one below it, and the board's top is level with the top of the gap, the frame it lies in.
# The right half takes one of three modules on its pogo mount, all on the same keyboard board (the firmware finds
# which one is there: zmk-ergo-cai pogo_detect): an assembly for each, to look at and to print the case it needs.
#   ergocai_right                 the joystick (and its retainer)
#   ergocai_right_trackball       the trackball read from above (its ball cup), in the joystick's case
#   ergocai_right_side_trackball  the trackball read from the side, in the right_*_side case layers
# and one with the trackball on the keyboard board itself, a board of its own (ergo_cai_right_trackball):
#   ergocai_right_trackball_board the trackball read from above, its sensor on the keyboard board, its seat in the
#                                 joystick's case
assemblies:
  ergocai_right:
    stack: [right_buttom, right_gap, right_switchplate, right_middle, right_top]
    pcb:
      name: ergo_cai_right
      top: right_gap
    # the e-paper module (ErgoCai.modules e-paper/2.13inch, exported from KiCad with its models) on the e-paper
    # socket's four holes, over the 18650 cell: its board's bottom at 30 mm, on 22 mm standoffs from the pcb
    parts:
      - name: e-paper
        model: "github:shiqi-614/ErgoCai.modules/e-paper/2.13inch/2.13inch.glb"
        at_module: e-paper
        z: 30
      # the joystick module (ErgoCai.modules joystick/Alpsalpine-pogo, exported from KiCad with its models) on the
      # joystick mount: its board's bottom 3.8 mm over the pcb's top
      - name: joystick
        model: "github:shiqi-614/ErgoCai.modules/joystick/Alpsalpine-pogo/Alpsalpine-pogo.glb"
        at_module: joystick
        # turned half a turn on the mount: its pogo pins to the pads at x -11, by the thumb
        rotate: 180
        # the retainer's spacers hold the board 3.8 mm over the pcb, so the pins work at 3.8 mm: the pcb's top at 8
        z: 11.8
      # the printed retainer: its frame and base screwed together through the joystick module's corners, one
      # cartridge that snaps into the case by a hook at each end (ErgoCai.modules joystick/Alpsalpine-pogo/retainer);
      # the frame's feet on the module board's top, the base (spacers, the post under the stick) under it
      - name: retainer
        model: "github:shiqi-614/ErgoCai.modules/joystick/Alpsalpine-pogo/retainer/retainer.glb"
        at_module: joystick
        # turned half a turn on the mount: its pogo pins to the pads at x -11, by the thumb
        rotate: 180
        z: 13.4
  ergocai_right_trackball:
    stack: [right_buttom, right_gap, right_switchplate, right_middle, right_top]
    pcb:
      name: ergo_cai_right
      top: right_gap
    parts:
      - name: e-paper
        model: "github:shiqi-614/ErgoCai.modules/e-paper/2.13inch/2.13inch.glb"
        at_module: e-paper
        z: 30
      # the trackball module (ErgoCai.modules trackball/PMW3610-pogo) with its ball cup and 20 mm ball, turned half a
      # turn as the joystick is, its board on the cup's base 3.8 mm over the pcb
      - name: trackball
        model: "github:shiqi-614/ErgoCai.modules/trackball/PMW3610-pogo/PMW3610-pogo.glb"
        at_module: joystick
        rotate: 180
        z: 11.8
  ergocai_right_side_trackball:
    stack: [right_buttom, right_gap, right_switchplate_side, right_middle_side, right_top_side]
    pcb:
      name: ergo_cai_right
      top: right_gap
    parts:
      - name: e-paper
        model: "github:shiqi-614/ErgoCai.modules/e-paper/2.13inch/2.13inch.glb"
        at_module: e-paper
        z: 30
      # the side-read trackball module (ErgoCai.modules trackball/PMW3610-side-pogo, its cartridge and sensor board in
      # its model) as it is on the mount, not turned: its board's bottom at 11.8, on the base's 3.8 mm spacers
      - name: side-trackball
        model: "github:shiqi-614/ErgoCai.modules/trackball/PMW3610-side-pogo/PMW3610-side-pogo.glb"
        at_module: joystick
        z: 11.8
  ergocai_right_trackball_board:
    stack: [right_buttom, right_gap, right_switchplate, right_middle, right_top]
    pcb:
      name: ergo_cai_right_trackball
      top: right_gap
    # the ball seat (TB_CUP1, its model with the ball) is the board's own footprint: nothing more to add
    parts:
      - name: e-paper
        model: "github:shiqi-614/ErgoCai.modules/e-paper/2.13inch/2.13inch.glb"
        at_module: e-paper
        z: 30
  ergocai_left:
    stack: [left_buttom, left_gap, left_switchplate, left_middle, left_top]
    pcb:
      name: ergo_cai_left
      top: left_gap
    # the e-paper module (ErgoCai.modules e-paper/2.13inch, exported from KiCad with its models) on the e-paper
    # socket's four holes, over the 18650 cell: its board's bottom at 30 mm, on 22 mm standoffs from the pcb
    parts:
      - name: e-paper
        model: "github:shiqi-614/ErgoCai.modules/e-paper/2.13inch/2.13inch.glb"
        at_module: e-paper
        z: 30
  # Each half with the tenting legs (cases *_tent_*): folded, and with the tentLow or the tentHigh pair standing; the
  # seats under the inner screws, the bumpers by the outer edge. Each case of legs hangs under the bottom plate, its
  # bottom that far under the plate's underside (z 0).
  ergocai_right_tent_folded:
    stack:
      - {name: right_tent_folded, z: -(tentPivotZ + tentLegW / 2)}
      - {name: right_buttom, z: 0}
      - right_gap
      - right_switchplate
      - right_middle
      - right_top
    pcb:
      name: ergo_cai_right
      top: right_gap
    parts:
      - name: e-paper
        model: "github:shiqi-614/ErgoCai.modules/e-paper/2.13inch/2.13inch.glb"
        at_module: e-paper
        z: 30
      - name: joystick
        model: "github:shiqi-614/ErgoCai.modules/joystick/Alpsalpine-pogo/Alpsalpine-pogo.glb"
        at_module: joystick
        rotate: 180
        z: 11.8
      - name: retainer
        model: "github:shiqi-614/ErgoCai.modules/joystick/Alpsalpine-pogo/retainer/retainer.glb"
        at_module: joystick
        rotate: 180
        z: 13.4
      # the tenting legs' printed seats (ErgoCai.modules tent/tent.js) under the case's screws, their tops on the
      # bottom plate's underside; the bumpers flush with the straight outer edge (0.8kx past matrix_col6_row0 and the
      # case's 8 mm), each 6.3 mm from the outer screw beside it, clear of its head
      - name: tent-seat-top
        model: "github:shiqi-614/ErgoCai.modules/tent/seat.glb"
        where: {ref: matrix_col0_row0, shift: [-1.85kx, 1.25ky]}
      - name: tent-seat-thumb
        model: "github:shiqi-614/ErgoCai.modules/tent/seat-mirrored.glb"
        where: {ref: thumbs_col1_row5, shift: [-0.75kx, -0.77ky]}
      - name: tent-bumper-top
        model: "github:shiqi-614/ErgoCai.modules/tent/bumper.glb"
        where: {ref: matrix_col6_row0, shift: [0.8kx + 8 - tentBumperD / 2, 1.25ky - 6.25]}
      - name: tent-bumper-bottom
        model: "github:shiqi-614/ErgoCai.modules/tent/bumper.glb"
        where: {ref: matrix_col6_row0, shift: [0.8kx + 8 - tentBumperD / 2, -4.7ky + 3.6]}
  ergocai_right_tent_low:
    stack:
      - {name: right_tent_low, z: -(tentPivotZ + tentOpenLow)}
      - {name: right_buttom, z: 0}
      - right_gap
      - right_switchplate
      - right_middle
      - right_top
    pcb:
      name: ergo_cai_right
      top: right_gap
    parts:
      - name: e-paper
        model: "github:shiqi-614/ErgoCai.modules/e-paper/2.13inch/2.13inch.glb"
        at_module: e-paper
        z: 30
      - name: joystick
        model: "github:shiqi-614/ErgoCai.modules/joystick/Alpsalpine-pogo/Alpsalpine-pogo.glb"
        at_module: joystick
        rotate: 180
        z: 11.8
      - name: retainer
        model: "github:shiqi-614/ErgoCai.modules/joystick/Alpsalpine-pogo/retainer/retainer.glb"
        at_module: joystick
        rotate: 180
        z: 13.4
      - name: tent-seat-top
        model: "github:shiqi-614/ErgoCai.modules/tent/seat.glb"
        where: {ref: matrix_col0_row0, shift: [-1.85kx, 1.25ky]}
      - name: tent-seat-thumb
        model: "github:shiqi-614/ErgoCai.modules/tent/seat-mirrored.glb"
        where: {ref: thumbs_col1_row5, shift: [-0.75kx, -0.77ky]}
      - name: tent-bumper-top
        model: "github:shiqi-614/ErgoCai.modules/tent/bumper.glb"
        where: {ref: matrix_col6_row0, shift: [0.8kx + 8 - tentBumperD / 2, 1.25ky - 6.25]}
      - name: tent-bumper-bottom
        model: "github:shiqi-614/ErgoCai.modules/tent/bumper.glb"
        where: {ref: matrix_col6_row0, shift: [0.8kx + 8 - tentBumperD / 2, -4.7ky + 3.6]}
  ergocai_right_tent_high:
    stack:
      - {name: right_tent_high, z: -(tentPivotZ + tentOpenHigh)}
      - {name: right_buttom, z: 0}
      - right_gap
      - right_switchplate
      - right_middle
      - right_top
    pcb:
      name: ergo_cai_right
      top: right_gap
    parts:
      - name: e-paper
        model: "github:shiqi-614/ErgoCai.modules/e-paper/2.13inch/2.13inch.glb"
        at_module: e-paper
        z: 30
      - name: joystick
        model: "github:shiqi-614/ErgoCai.modules/joystick/Alpsalpine-pogo/Alpsalpine-pogo.glb"
        at_module: joystick
        rotate: 180
        z: 11.8
      - name: retainer
        model: "github:shiqi-614/ErgoCai.modules/joystick/Alpsalpine-pogo/retainer/retainer.glb"
        at_module: joystick
        rotate: 180
        z: 13.4
      - name: tent-seat-top
        model: "github:shiqi-614/ErgoCai.modules/tent/seat.glb"
        where: {ref: matrix_col0_row0, shift: [-1.85kx, 1.25ky]}
      - name: tent-seat-thumb
        model: "github:shiqi-614/ErgoCai.modules/tent/seat-mirrored.glb"
        where: {ref: thumbs_col1_row5, shift: [-0.75kx, -0.77ky]}
      - name: tent-bumper-top
        model: "github:shiqi-614/ErgoCai.modules/tent/bumper.glb"
        where: {ref: matrix_col6_row0, shift: [0.8kx + 8 - tentBumperD / 2, 1.25ky - 6.25]}
      - name: tent-bumper-bottom
        model: "github:shiqi-614/ErgoCai.modules/tent/bumper.glb"
        where: {ref: matrix_col6_row0, shift: [0.8kx + 8 - tentBumperD / 2, -4.7ky + 3.6]}
  ergocai_left_tent_folded:
    stack:
      - {name: left_tent_folded, z: -(tentPivotZ + tentLegW / 2)}
      - {name: left_buttom, z: 0}
      - left_gap
      - left_switchplate
      - left_middle
      - left_top
    pcb:
      name: ergo_cai_left
      top: left_gap
    parts:
      - name: e-paper
        model: "github:shiqi-614/ErgoCai.modules/e-paper/2.13inch/2.13inch.glb"
        at_module: e-paper
        z: 30
      # the left half's seats: the mirror images of the right half's, which are the other seat turned a half turn
      - name: tent-seat-top
        model: "github:shiqi-614/ErgoCai.modules/tent/seat-mirrored.glb"
        where: {ref: mirror_matrix_col0_row0, shift: [-1.85kx, 1.25ky]}
        rotate: 180
      - name: tent-seat-thumb
        model: "github:shiqi-614/ErgoCai.modules/tent/seat.glb"
        where: {ref: mirror_thumbs_col1_row5, shift: [-0.75kx, -0.77ky]}
        rotate: 180
      - name: tent-bumper-top
        model: "github:shiqi-614/ErgoCai.modules/tent/bumper.glb"
        where: {ref: mirror_matrix_col6_row0, shift: [0.8kx + 8 - tentBumperD / 2, 1.25ky - 6.25]}
      - name: tent-bumper-bottom
        model: "github:shiqi-614/ErgoCai.modules/tent/bumper.glb"
        where: {ref: mirror_matrix_col6_row0, shift: [0.8kx + 8 - tentBumperD / 2, -4.7ky + 3.6]}
  ergocai_left_tent_low:
    stack:
      - {name: left_tent_low, z: -(tentPivotZ + tentOpenLow)}
      - {name: left_buttom, z: 0}
      - left_gap
      - left_switchplate
      - left_middle
      - left_top
    pcb:
      name: ergo_cai_left
      top: left_gap
    parts:
      - name: e-paper
        model: "github:shiqi-614/ErgoCai.modules/e-paper/2.13inch/2.13inch.glb"
        at_module: e-paper
        z: 30
      - name: tent-seat-top
        model: "github:shiqi-614/ErgoCai.modules/tent/seat-mirrored.glb"
        where: {ref: mirror_matrix_col0_row0, shift: [-1.85kx, 1.25ky]}
        rotate: 180
      - name: tent-seat-thumb
        model: "github:shiqi-614/ErgoCai.modules/tent/seat.glb"
        where: {ref: mirror_thumbs_col1_row5, shift: [-0.75kx, -0.77ky]}
        rotate: 180
      - name: tent-bumper-top
        model: "github:shiqi-614/ErgoCai.modules/tent/bumper.glb"
        where: {ref: mirror_matrix_col6_row0, shift: [0.8kx + 8 - tentBumperD / 2, 1.25ky - 6.25]}
      - name: tent-bumper-bottom
        model: "github:shiqi-614/ErgoCai.modules/tent/bumper.glb"
        where: {ref: mirror_matrix_col6_row0, shift: [0.8kx + 8 - tentBumperD / 2, -4.7ky + 3.6]}
  ergocai_left_tent_high:
    stack:
      - {name: left_tent_high, z: -(tentPivotZ + tentOpenHigh)}
      - {name: left_buttom, z: 0}
      - left_gap
      - left_switchplate
      - left_middle
      - left_top
    pcb:
      name: ergo_cai_left
      top: left_gap
    parts:
      - name: e-paper
        model: "github:shiqi-614/ErgoCai.modules/e-paper/2.13inch/2.13inch.glb"
        at_module: e-paper
        z: 30
      - name: tent-seat-top
        model: "github:shiqi-614/ErgoCai.modules/tent/seat-mirrored.glb"
        where: {ref: mirror_matrix_col0_row0, shift: [-1.85kx, 1.25ky]}
        rotate: 180
      - name: tent-seat-thumb
        model: "github:shiqi-614/ErgoCai.modules/tent/seat.glb"
        where: {ref: mirror_thumbs_col1_row5, shift: [-0.75kx, -0.77ky]}
        rotate: 180
      - name: tent-bumper-top
        model: "github:shiqi-614/ErgoCai.modules/tent/bumper.glb"
        where: {ref: mirror_matrix_col6_row0, shift: [0.8kx + 8 - tentBumperD / 2, 1.25ky - 6.25]}
      - name: tent-bumper-bottom
        model: "github:shiqi-614/ErgoCai.modules/tent/bumper.glb"
        where: {ref: mirror_matrix_col6_row0, shift: [0.8kx + 8 - tentBumperD / 2, -4.7ky + 3.6]}
`
};

export default ErgoCai;
