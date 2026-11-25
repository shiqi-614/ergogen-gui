import {ConfigExample} from "./index";

const RowStaggerSplit : ConfigExample = {
    label: "RowStaggerSplit",
    author: "jinsongc",
    value: `
# RowStaggerSplit: a split keyboard with the rows of an ordinary (ANSI 60%) keyboard, staggered row by row
# (0.5u, 0.25u, 0.5u from the number row down) and keys of their own widths (Tab 1.5u, Caps 1.75u, Shift 2.25u,
# ...). One zone per half: its columns are the matrix columns (1 Q A Z, 2 W S X, ... slanting down to the right),
# its rows the keyboard's, from the bottom up. The stagger is a shift of the whole row (zones.<half>.rows.<row>.shift);
# a key wider than 1u sets its width and its own shift: (w - 1) / 2 from the 1u grid where it starts the row (left
# edge flush), the row's stagger plus that where it ends the row. The right half is not the left one mirrored (that
# would stagger its rows the other way), so it is a zone of its own, on a pcb of its own. The right half has a B of
# its own too, left of N, for whoever presses B with the right hand. Each half has a strip on its inner side with the
# e-paper (ErgoCai.modules e-paper/2.13inch-socket) halfway down, stacked as on ErgoCai: the MCU on the board's back,
# the 18650 (or a pouch cell on its JST connector) on its front, the e-paper module over the cell on four standoffs on
# the top plate, their M2 screws coming up through the middle layer. The charger and the power switch are at the top
# edge's inner end, by them. The case is ErgoCai's five layers.
units:
  kx: U                    # 19.05 mm, an ordinary keyboard's key pitch
  ky: U
  topStagger: 0.5kx        # each row's shift from the number row
  homeStagger: 0.75kx
  bottomStagger: 1.25kx
  strip: 34                # the strip on each half's inner side: the e-paper's 30.1 mm and 2 mm either side
  # the right half's strip, 8.5 mm wider on the keys' side: its B and Space reach into it, and a key under the e-paper
  # (from the board's middle down) could not be pressed; the e-paper stays strip / 2 from the inner edge, so 1.4 mm
  # clear of Space's keycap and 6.2 mm of B's
  rightStrip: strip + 8.5
  # how far the right half sits from where it would be on a one-piece keyboard: the 1.25kx the left half's B reaches
  # past the start of the right half's Space, the two strips, and 1kx (1.5kx since the right half's strip begins
  # beside Y, 0.5kx in from Space) between the boards
  splitGap: 2.25kx + strip + rightStrip
  top: 1ky                 # how far above the number row's keys the strip with the USB port and the switch reaches
  lip: 2.5                 # the board's edge this far past a key that has no key beyond it, clear of its diode's pads
  # the inner strip's stack (the e-paper, the 18650 under it, the MCU) centred between the board's top and bottom
  # edges: its centre this far above the bottom row (the top edge is 3ky + top above it, the bottom 1.5ky + lip below)
  paper: (1.5ky + top - lip) / 2
  # the case's screws (top and bottom plates) and the studs between (gap, switchplate, middle), as on ErgoCai
  screwSize: 1.05
  studSize: 1.75
  # the funnel through the case wall in front of each half's USB port and power switch, as on ErgoCai: its half width
  # where it starts (that of the room the plug and the lever need, the 11.2 mm Dwgs.User boxes of USB_J1 and BAT_SW1,
  # which the switch plate cuts), its half width at the far end, how far out that is, and how far out from the board's
  # edge it starts: the gap layer is a frame round the board, which that strip holds together
  funnelNarrow: 5.6
  funnelWide: 25
  funnelDepth: 10
  funnelLip: 2
points:
  key:
    spread: kx
    padding: ky
    width: kx - 1
    height: ky - 1
  zones:
    left:
      columns:
        # grave accent, Tab, Caps, Shift, Ctrl: left edge flush
        c0:
          rows:
            top: {width: 1.5kx - 1, shift: [0.25kx, 0]}
            home: {width: 1.75kx - 1, shift: [0.375kx, 0]}
            bottom: {width: 2.25kx - 1, shift: [0.625kx, 0]}
            mods: {width: 1.25kx - 1, shift: [0.125kx, 0]}
        # 1 Q A Z, Win
        c1:
          rows.mods: {width: 1.25kx - 1, shift: [0.375kx, 0]}
        # 2 W S X, Alt
        c2:
          rows.mods: {width: 1.25kx - 1, shift: [0.625kx, 0]}
        # 3 E D C
        c3:
          rows.mods.skip: true
        # 4 R F V, Space 2.25u: as far in from F as the right half's Space is from J (0.875kx), under the left thumb;
        # its right edge is B's, and the 1.25kx between it and Alt is left empty
        c4:
          rows.mods: {width: 2.25kx - 1, shift: [1.625kx, 0]}
        # 5 T G B
        c5:
          rows.mods.skip: true
        # 6, wired into the free mods/c5 spot of the matrix so that no column has a single key
        c6:
          rows:
            num: {row_net: mods, column_net: c5}
            mods.skip: true
            bottom.skip: true
            home.skip: true
            top.skip: true
      rows:
        mods:
        bottom.shift: [bottomStagger, 0]
        home.shift: [homeStagger, 0]
        top.shift: [topStagger, 0]
        num:
    right:
      # its first column is the one of its B; Y H N comes next, under where 6 is on the left half
      anchor:
        shift: [5kx + splitGap, 0]
      columns:
        # B, left of N: wired into the free num/c0 spot of the matrix (Y H N's column), so that no column has a
        # single key
        b:
          rows:
            bottom: {row_net: num, column_net: c0}
            mods.skip: true
            home.skip: true
            top.skip: true
            num.skip: true
        # Y H N, Space 2.75u
        c0:
          rows:
            num.skip: true
            mods: {width: 2.75kx - 1, shift: [0.875kx, 0]}
        # 7 U J M
        c1:
          rows.mods.skip: true
        # 8 I K ,
        c2:
          rows.mods.skip: true
        # 9 O L ., Fn
        c3:
          rows.mods: {width: 1.25kx - 1, shift: [-0.125kx, 0]}
        # 0 P ; /, Alt
        c4:
          rows.mods: {width: 1.25kx - 1, shift: [0.125kx, 0]}
        # - [ ' Shift 2.75u, Win
        c5:
          rows:
            bottom: {width: 2.75kx - 1, shift: [bottomStagger + 0.875kx, 0]}
            mods: {width: 1.25kx - 1, shift: [0.375kx, 0]}
        # = ] Enter 2.25u, Menu
        c6:
          rows:
            home: {width: 2.25kx - 1, shift: [homeStagger + 0.625kx, 0]}
            bottom.skip: true
            mods: {width: 1.25kx - 1, shift: [0.625kx, 0]}
        # Backspace 2u, backslash 1.5u, Ctrl
        c7:
          rows:
            num: {width: 2kx - 1, shift: [0.5kx, 0]}
            top: {width: 1.5kx - 1, shift: [topStagger + 0.25kx, 0]}
            home.skip: true
            bottom.skip: true
            mods: {width: 1.25kx - 1, shift: [0.875kx, 0]}
      rows:
        mods:
        bottom.shift: [bottomStagger, 0]
        home.shift: [homeStagger, 0]
        top.shift: [topStagger, 0]
        num:

outlines:
  # each half's board, a rectangle: the keys, the strip above the number row (USB port, power switch, charger) and the
  # strip on the inner side (e-paper, 18650, MCU); on the outer side the board ends lip past the keys
  left_board:
    - what: polygon
      operation: stack
      points:
        - ref: left_c0_num
          shift: [-0.5kx - lip, top]
        # B is the inner side's last key, its right edge 0.5kx from its centre
        - ref: left_c5_bottom
          shift: [0.5kx + strip, 3ky + top]
        - ref: left_c5_bottom
          shift: [0.5kx + strip, -1.5ky - lip]
        - ref: left_c0_mods
          shift: [-0.625kx - lip, -0.5ky - lip]
  right_board:
    - what: polygon
      operation: stack
      points:
        # the strip (rightStrip wide) is beside Y, the inner side's first key in the rows by the e-paper (its left edge
        # 0.5kx from its centre); Space and B reach into it, beside the e-paper
        - ref: right_c0_top
          shift: [-0.5kx - rightStrip, ky + top]
        - ref: right_c7_num
          shift: [1kx + lip, top]
        - ref: right_c7_mods
          shift: [0.625kx + lip, -0.5ky - lip]
        - ref: right_c0_top
          shift: [-0.5kx - rightStrip, -3.5ky - lip]
  # the funnels in front of the two USB ports and the two power switches, starting funnelLip out from the boards' top
  # edge; each half's case cuts all four, the other half's are outside it. They are added: a half's two overlap at
  # their far ends.
  funnels:
    - what: polygon
      points:
        - ref: left_c3_num
          shift: [funnelWide, top + funnelLip + funnelDepth]
        - ref: left_c3_num
          shift: [funnelNarrow, top + funnelLip]
        - ref: left_c3_num
          shift: [-funnelNarrow, top + funnelLip]
        - ref: left_c3_num
          shift: [-funnelWide, top + funnelLip + funnelDepth]
    - what: polygon
      points:
        - ref: left_c5_bottom
          shift: [0.5kx + strip / 2 + funnelWide, 3ky + top + funnelLip + funnelDepth]
        - ref: left_c5_bottom
          shift: [0.5kx + strip / 2 + funnelNarrow, 3ky + top + funnelLip]
        - ref: left_c5_bottom
          shift: [0.5kx + strip / 2 - funnelNarrow, 3ky + top + funnelLip]
        - ref: left_c5_bottom
          shift: [0.5kx + strip / 2 - funnelWide, 3ky + top + funnelLip + funnelDepth]
    - what: polygon
      points:
        - ref: right_c4_num
          shift: [funnelWide, top + funnelLip + funnelDepth]
        - ref: right_c4_num
          shift: [funnelNarrow, top + funnelLip]
        - ref: right_c4_num
          shift: [-funnelNarrow, top + funnelLip]
        - ref: right_c4_num
          shift: [-funnelWide, top + funnelLip + funnelDepth]
    - what: polygon
      points:
        - ref: right_c0_top
          shift: [-0.5kx - rightStrip + strip / 2 + funnelWide, ky + top + funnelLip + funnelDepth]
        - ref: right_c0_top
          shift: [-0.5kx - rightStrip + strip / 2 + funnelNarrow, ky + top + funnelLip]
        - ref: right_c0_top
          shift: [-0.5kx - rightStrip + strip / 2 - funnelNarrow, ky + top + funnelLip]
        - ref: right_c0_top
          shift: [-0.5kx - rightStrip + strip / 2 - funnelWide, ky + top + funnelLip + funnelDepth]

  # The case of each half, ErgoCai's five layers (cases, assemblies): the board grown by 8 mm, the gap a frame round
  # the board. Where its parts are screwed together: on that frame, 3 mm out from the board's corners and from the
  # middle of its top edge (between the USB port and the power switch, 23.8 mm from the port) and of its bottom edge.
  _left_mounts:
    $params: [__what__, __radius__]
    top_outer:
      what: __what__
      radius: __radius__
      where:
        ref: left_c0_num
        shift: [-0.5kx - lip - 3, top + 3]
    top_middle:
      what: __what__
      radius: __radius__
      where:
        ref: left_c4_num
        shift: [4.775, top + 3]
    top_inner:
      what: __what__
      radius: __radius__
      where:
        ref: left_c5_bottom
        shift: [0.5kx + strip + 3, 3ky + top + 3]
    bottom_inner:
      what: __what__
      radius: __radius__
      where:
        ref: left_c5_bottom
        shift: [0.5kx + strip + 3, -1.5ky - lip - 3]
    bottom_middle:
      what: __what__
      radius: __radius__
      where:
        ref: left_c3_bottom
        shift: [0, -1.5ky - lip - 3]
    bottom_outer:
      what: __what__
      radius: __radius__
      where:
        ref: left_c0_mods
        shift: [-0.625kx - lip - 3, -0.5ky - lip - 3]
  _right_mounts:
    $params: [__what__, __radius__]
    top_inner:
      what: __what__
      radius: __radius__
      where:
        ref: right_c0_top
        shift: [-0.5kx - rightStrip - 3, ky + top + 3]
    top_middle:
      what: __what__
      radius: __radius__
      where:
        ref: right_c3_num
        shift: [-4.775, top + 3]
    top_outer:
      what: __what__
      radius: __radius__
      where:
        ref: right_c7_num
        shift: [1kx + lip + 3, top + 3]
    bottom_outer:
      what: __what__
      radius: __radius__
      where:
        ref: right_c7_mods
        shift: [0.625kx + lip + 3, -0.5ky - lip - 3]
    bottom_middle:
      what: __what__
      radius: __radius__
      where:
        ref: right_c2_bottom
        shift: [0, -1.5ky - lip - 3]
    bottom_inner:
      what: __what__
      radius: __radius__
      where:
        ref: right_c0_top
        shift: [-0.5kx - rightStrip - 3, -3.5ky - lip - 3]
  left_studs:
    $extends: outlines._left_mounts
    $args: [hexagon, studSize]
  left_screws:
    $extends: outlines._left_mounts
    $args: [circle, screwSize]
  right_studs:
    $extends: outlines._right_mounts
    $args: [hexagon, studSize]
  right_screws:
    $extends: outlines._right_mounts
    $args: [circle, screwSize]
  left_case:
    - name: left_board
      expand: 8
  right_case:
    - name: right_board
      expand: 8
  # the gap, switchplate and middle: the case less the studs
  left_combo:
    - name: left_case
    - operation: subtract
      name: left_studs
  right_combo:
    - name: right_case
    - operation: subtract
      name: right_studs
  # The keycaps' room in the top and the middle: each key's cell, as wide as the key, grown by 0.5 mm. ErgoCai cuts its
  # keys' Dwgs.User keycap outline grown by 0.5, but ErgoCaiLib has that outline for 1u, 1.5u and 2u keys only, and
  # the 1.25u, 1.75u, 2.25u and 2.75u keys here take the nearest one, so it is drawn from the points.
  left_caps:
    - what: rectangle
      where: /^left_/
      size: [kx + 1, ky + 1]
    - what: rectangle
      where: [left_c0_mods, left_c1_mods, left_c2_mods]
      size: [1.25kx + 1, ky + 1]
    - what: rectangle
      where: [left_c0_top]
      size: [1.5kx + 1, ky + 1]
    - what: rectangle
      where: [left_c0_home]
      size: [1.75kx + 1, ky + 1]
    - what: rectangle
      where: [left_c0_bottom, left_c4_mods]
      size: [2.25kx + 1, ky + 1]
  right_caps:
    - what: rectangle
      where: /^right_/
      size: [kx + 1, ky + 1]
    - what: rectangle
      where: [right_c3_mods, right_c4_mods, right_c5_mods, right_c6_mods, right_c7_mods]
      size: [1.25kx + 1, ky + 1]
    - what: rectangle
      where: [right_c7_top]
      size: [1.5kx + 1, ky + 1]
    - what: rectangle
      where: [right_c7_num]
      size: [2kx + 1, ky + 1]
    - what: rectangle
      where: [right_c6_home]
      size: [2.25kx + 1, ky + 1]
    - what: rectangle
      where: [right_c0_mods, right_c5_bottom]
      size: [2.75kx + 1, ky + 1]

# Two pcbs, neither mirrored from the other: each has its half's keys (where: the zone's name) and parts of its own.
# keys2 / keys3 / stab are the wider keys: the last "key" footprint on a key is the one it gets (as on ErgoCai).
# ErgoCaiLib has switches of 1u, 1.5u and 2u only, so 1.25u and 1.75u keys take the 1.5u one and 2.25u / 2.75u keys
# the 2u one (the same switch and pads; only the keycap outline on Dwgs.User is off, which is why the case draws its
# keycap openings from the points).
pcbs:
  row_stagger_left:
    outlines:
      main:
        outline: left_board
    footprints:
      keys1:
        what:
          github:
            repo: "shiqi-614/ErgoCaiLib"
            file: "footprints/ErgoCai.pretty/SW_MX_HS_CPG151101S11_1u.kicad_mod"
        where: /^left_/
      keys2:
        what:
          github:
            repo: "shiqi-614/ErgoCaiLib"
            file: "footprints/ErgoCai.pretty/SW_MX_HS_CPG151101S11_1.5u.kicad_mod"
        where: [left_c0_top, left_c0_home, left_c0_mods, left_c1_mods, left_c2_mods]
      keys3:
        what:
          github:
            repo: "shiqi-614/ErgoCaiLib"
            file: "footprints/ErgoCai.pretty/SW_MX_HS_CPG151101S11_2u.kicad_mod"
        where: [left_c0_bottom, left_c4_mods]
      diodes:
        what:
          github:
            repo: "shiqi-614/ErgoCaiLib"
            file: "footprints/ErgoCai.pretty/Diode-Dual.kicad_mod"
        where: /^left_/
        adjust:
          shift: [0, -8.4]
          rotate: 180
        side: back
      stab:
        what:
          github:
            repo: "shiqi-614/ErgoCaiLib"
            file: "footprints/ErgoCai.pretty/STAB_MX_2u.kicad_mod"
        where: [left_c0_bottom, left_c4_mods]
    modules:
      # The stack in the inner strip, as on ErgoCai: the MCU on the back, 6 mm above the cell's and the e-paper's point,
      # turned so that its antenna points toward the inner edge and as far out as it goes: the antenna keep-out, 11 mm
      # from the module's centre, to the edge (the antenna kept clear of copper and of the other parts, as the
      # module's manual asks); the 18650 on the front, centred under the e-paper.
      mcu:
        what:
          github:
            repo: "shiqi-614/ErgoCai.modules"
            file: "mcu/E73-2G4M08S1C/E73-2G4M08S1C.kicad_pcb"
        where:
          ref: left_c5_bottom
          shift: [0.5kx + strip - 11, paper + 6]
          rotate: -90
      battery:
        what:
          github:
            repo: "shiqi-614/ErgoCai.modules"
            file: "battery/18650_Nickel/18650_Nickel.kicad_pcb"
        where:
          ref: left_c5_bottom
          shift: [0.5kx + strip / 2, paper]
      # A pouch LiPo's connector, for a cell in the battery opening instead of the 18650 (fit one or the other), as on
      # ErgoCai: on the holder's axis, its entry facing the holder's end and its courtyard 0.5 mm past the holder's, so
      # the cell's plug goes in from the opening, which the connector's cut-out in the switchplate joins.
      jst-ph-battery-backup:
        what:
          github:
            repo: "shiqi-614/ErgoCai.modules"
            file: "battery/JST_PH_P2.00mm/JST_PH_P2.00mm.kicad_pcb"
        where:
          ref: left_c5_bottom
          shift: [0.5kx + strip / 2, paper + 42.5]
      # on the back, above 6 and toward the strip, its VBAT side toward the cell's VBAT end, its OUT side toward the
      # power switch
      charger:
        what:
          github:
            repo: "shiqi-614/ErgoCai.modules"
            file: "battery/BQ24072_charger/BQ24072_charger.kicad_pcb"
        where:
          ref: left_c6_num
          shift: [7.5, top - 8.05]
          rotate: 90
        side: back
      # its mouth 2.55 mm past the board's top edge, 1.5 mm further out than on ErgoCai: the module's origin 1.2 mm
      # inside the edge, its shield pads still 0.9 mm in
      usb:
        what:
          github:
            repo: "shiqi-614/ErgoCai.modules"
            file: "usb/default_usb/default_usb.kicad_pcb"
        where:
          ref: left_c3_num
          shift: [0, top - 1.2]
      # straight above the battery, on its axis, at the top edge
      power_switch:
        what:
          github:
            repo: "shiqi-614/ErgoCai.modules"
            file: "battery/power_switch_right/power_switch_right.kicad_pcb"
        where:
          ref: left_c5_bottom
          shift: [0.5kx + strip / 2, 3ky + top - 2.55]
      # where ErgoCai has it from the MCU, 12 mm toward the keys and 46.5 mm down, beside the e-paper's FFC socket;
      # its plunger over the hole in the bottom plate
      reset:
        what:
          github:
            repo: "shiqi-614/ErgoCai.modules"
            file: "reset/reset/reset.kicad_pcb"
        where:
          ref: left_c5_bottom
          shift: [0.5kx + strip / 2 - 12, paper + 6 - 46.5]
          rotate: 180
      # the e-paper's socket (ErgoCai.modules e-paper/2.13inch-socket: the panel module's 30.1 x 68.9 mm on four
      # holes, its FFC down through a slot in the board to a socket on the back, 44.5 mm below the panel's centre),
      # in the middle of the inner strip, halfway between the board's top and bottom edges
      e-paper:
        what:
          github:
            repo: "shiqi-614/ErgoCai.modules"
            file: "e-paper/2.13inch-socket/2.13inch-socket.kicad_pcb"
        where:
          ref: left_c5_bottom
          shift: [0.5kx + strip / 2, paper]
  row_stagger_right:
    outlines:
      main:
        outline: right_board
    footprints:
      keys1:
        what:
          github:
            repo: "shiqi-614/ErgoCaiLib"
            file: "footprints/ErgoCai.pretty/SW_MX_HS_CPG151101S11_1u.kicad_mod"
        where: /^right_/
      keys2:
        what:
          github:
            repo: "shiqi-614/ErgoCaiLib"
            file: "footprints/ErgoCai.pretty/SW_MX_HS_CPG151101S11_1.5u.kicad_mod"
        where: [right_c7_top, right_c3_mods, right_c4_mods, right_c5_mods, right_c6_mods, right_c7_mods]
      keys3:
        what:
          github:
            repo: "shiqi-614/ErgoCaiLib"
            file: "footprints/ErgoCai.pretty/SW_MX_HS_CPG151101S11_2u.kicad_mod"
        where: [right_c7_num, right_c6_home, right_c5_bottom, right_c0_mods]
      diodes:
        what:
          github:
            repo: "shiqi-614/ErgoCaiLib"
            file: "footprints/ErgoCai.pretty/Diode-Dual.kicad_mod"
        where: /^right_/
        adjust:
          shift: [0, -8.4]
          rotate: 180
        side: back
      stab:
        what:
          github:
            repo: "shiqi-614/ErgoCaiLib"
            file: "footprints/ErgoCai.pretty/STAB_MX_2u.kicad_mod"
        where: [right_c7_num, right_c6_home, right_c5_bottom, right_c0_mods]
    modules:
      # the left half's parts the other way round: the stack in the inner strip beside Y, the charger and the power
      # switch by 7
      mcu:
        what:
          github:
            repo: "shiqi-614/ErgoCai.modules"
            file: "mcu/E73-2G4M08S1C/E73-2G4M08S1C.kicad_pcb"
        where:
          ref: right_c0_top
          shift: [-0.5kx - rightStrip + 11, paper - 2ky + 6]
          rotate: 90
      battery:
        what:
          github:
            repo: "shiqi-614/ErgoCai.modules"
            file: "battery/18650_Nickel/18650_Nickel.kicad_pcb"
        where:
          ref: right_c0_top
          shift: [-0.5kx - rightStrip + strip / 2, paper - 2ky]
      # A pouch LiPo's connector, for a cell in the battery opening instead of the 18650 (fit one or the other), as on
      # ErgoCai: on the holder's axis, its entry facing the holder's end and its courtyard 0.5 mm past the holder's, so
      # the cell's plug goes in from the opening, which the connector's cut-out in the switchplate joins.
      jst-ph-battery-backup:
        what:
          github:
            repo: "shiqi-614/ErgoCai.modules"
            file: "battery/JST_PH_P2.00mm/JST_PH_P2.00mm.kicad_pcb"
        where:
          ref: right_c0_top
          shift: [-0.5kx - rightStrip + strip / 2, paper - 2ky + 42.5]
      charger:
        what:
          github:
            repo: "shiqi-614/ErgoCai.modules"
            file: "battery/BQ24072_charger/BQ24072_charger.kicad_pcb"
        where:
          ref: right_c1_num
          shift: [-12.2, top - 8.05]
          rotate: -90
        side: back
      usb:
        what:
          github:
            repo: "shiqi-614/ErgoCai.modules"
            file: "usb/default_usb/default_usb.kicad_pcb"
        where:
          ref: right_c4_num
          shift: [0, top - 1.2]
      power_switch:
        what:
          github:
            repo: "shiqi-614/ErgoCai.modules"
            file: "battery/power_switch_right/power_switch_right.kicad_pcb"
        # straight above the battery, as on the left half
        where:
          ref: right_c0_top
          shift: [-0.5kx - rightStrip + strip / 2, ky + top - 2.55]
      reset:
        what:
          github:
            repo: "shiqi-614/ErgoCai.modules"
            file: "reset/reset/reset.kicad_pcb"
        where:
          ref: right_c0_top
          # 12 mm toward the keys, as on the left half
          shift: [-0.5kx - rightStrip + strip / 2 + 12, paper - 2ky + 6 - 46.5]
      e-paper:
        what:
          github:
            repo: "shiqi-614/ErgoCai.modules"
            file: "e-paper/2.13inch-socket/2.13inch-socket.kicad_pcb"
        where:
          ref: right_c0_top
          shift: [-0.5kx - rightStrip + strip / 2, paper - 2ky]

# Each half's case, ErgoCai's from the bottom up: bottom 3 mm, gap 5 (the frame the board lies in, its top level with
# the board's), switchplate 5, middle 5, top 3. The studs go through gap, switchplate and middle, the screws through
# top and bottom. A case cuts by the footprints of one pcb ("<pcb>.footprints.<name>"), so the halves don't need to be
# apart for their cut-outs to stay out of each other.
cases:
  left_top:
    - what: outline
      name: left_case
      extrude: 3
    - what: outline
      name: left_screws
      extrude: 3
      operation: subtract
    - what: outline
      name: left_caps
      extrude: 3
      operation: subtract
    - what: pcb
      name: /row_stagger_left.footprints.stab/
      extrude: 3
      operation: subtract
      expand: 0.5
      layers: [Dwgs.User]
    - what: pcb
      name: /row_stagger_left.modules.battery/
      extrude: 3
      operation: subtract
      expand: 0.5
    # the M2 screws of the e-paper's four standoffs, which stand on this plate
    - what: pcb
      name: /row_stagger_left.modules.e-paper.EPM_H/
      extrude: 3
      operation: subtract
      layers: ["*.Cu"]
  left_middle:
    - what: outline
      name: left_combo
      extrude: 5
    - what: outline
      name: left_caps
      extrude: 5
      operation: subtract
    - what: pcb
      name: /row_stagger_left.footprints.stab/
      extrude: 5
      operation: subtract
      expand: 0.5
      layers: [Dwgs.User]
    - what: pcb
      name: /row_stagger_left.modules.(charger|battery)/
      extrude: 5
      operation: subtract
      expand: 0.5
    - what: outline
      name: funnels
      extrude: 5
      operation: subtract
    # The way of the M2 screws up into the e-paper's standoffs on the top plate: this layer only lets them through, it
    # holds nothing. Grown by 1.1, each hole cuts into the battery's opening (0.05 mm apart at 1, a wall no printer
    # makes). ErgoCai widens its middle's battery opening by 5 mm toward the keys instead: there the keys' openings
    # start 4.5 mm past the battery's, so the holes on that side cut that strip into pieces, and it is taken out.
    # Here the strip between the holes and the keys is 12 mm or more, so it stays.
    - what: pcb
      name: /row_stagger_left.modules.e-paper.EPM_H/
      extrude: 5
      operation: subtract
      expand: 1.1
      layers: ["*.Cu"]
    # the e-paper FFC's way down to the slot in the board, in front of its socket on the back
    - what: pcb
      name: /row_stagger_left.modules.e-paper.EPM_FPC1/
      extrude: 5
      operation: subtract
      expand: 0.5
      layers: [Dwgs.User]
      side: back
  left_switchplate:
    - what: outline
      name: left_combo
      extrude: 5
    # the switches' plate cut-out (Eco2.User); the 2u footprints' keycap-size hole (Dwgs.User), as on ErgoCai
    - what: pcb
      name: /row_stagger_left.footprints.keys[12]/
      extrude: 5
      operation: subtract
      layers: [Eco2.User]
    - what: pcb
      name: /row_stagger_left.footprints.keys3/
      extrude: 5
      operation: subtract
      layers: [Dwgs.User]
    - what: pcb
      name: /row_stagger_left.footprints.stab/
      extrude: 5
      operation: subtract
      layers: [Dwgs.User]
    - what: pcb
      name: /row_stagger_left.modules.(charger|battery|jst-ph-battery-backup)/
      extrude: 5
      operation: subtract
      expand: 0.5
    - what: outline
      name: funnels
      extrude: 5
      operation: subtract
    # the power switch and the USB receptacle, with the room the lever and the plug need: drawn on Dwgs.User in their
    # footprints, over the whole part
    - what: pcb
      name: /row_stagger_left.modules.(usb.USB_J1|power_switch.BAT_SW1)/
      extrude: 5
      operation: subtract
      layers: [Dwgs.User]
    - what: pcb
      name: /row_stagger_left.modules.e-paper.EPM_FPC1/
      extrude: 5
      operation: subtract
      expand: 0.5
      layers: [Dwgs.User]
      side: back
  left_gap:
    - what: outline
      name: left_case
      extrude: 5
    - what: outline
      name: left_board
      extrude: 5
      operation: subtract
    - what: outline
      name: funnels
      extrude: 5
      operation: subtract
    - what: outline
      name: left_studs
      extrude: 5
      operation: subtract
  left_bottom:
    - what: outline
      name: left_case
      extrude: 3
    - what: outline
      name: left_screws
      extrude: 3
      operation: subtract
    - what: outline
      name: funnels
      extrude: 3
      operation: subtract
    # the reset button's hole, under its plunger: drawn on Dwgs.User in its footprint, on the board's back
    - what: pcb
      name: /row_stagger_left.modules.reset.RESRT_SW1/
      extrude: 3
      operation: subtract
      layers: [Dwgs.User]
      side: back
  right_top:
    - what: outline
      name: right_case
      extrude: 3
    - what: outline
      name: right_screws
      extrude: 3
      operation: subtract
    - what: outline
      name: right_caps
      extrude: 3
      operation: subtract
    - what: pcb
      name: /row_stagger_right.footprints.stab/
      extrude: 3
      operation: subtract
      expand: 0.5
      layers: [Dwgs.User]
    - what: pcb
      name: /row_stagger_right.modules.battery/
      extrude: 3
      operation: subtract
      expand: 0.5
    - what: pcb
      name: /row_stagger_right.modules.e-paper.EPM_H/
      extrude: 3
      operation: subtract
      layers: ["*.Cu"]
  right_middle:
    - what: outline
      name: right_combo
      extrude: 5
    - what: outline
      name: right_caps
      extrude: 5
      operation: subtract
    - what: pcb
      name: /row_stagger_right.footprints.stab/
      extrude: 5
      operation: subtract
      expand: 0.5
      layers: [Dwgs.User]
    - what: pcb
      name: /row_stagger_right.modules.(charger|battery)/
      extrude: 5
      operation: subtract
      expand: 0.5
    - what: outline
      name: funnels
      extrude: 5
      operation: subtract
    # the M2 screws' way up into the standoffs, as on the left half
    - what: pcb
      name: /row_stagger_right.modules.e-paper.EPM_H/
      extrude: 5
      operation: subtract
      expand: 1.1
      layers: ["*.Cu"]
    - what: pcb
      name: /row_stagger_right.modules.e-paper.EPM_FPC1/
      extrude: 5
      operation: subtract
      expand: 0.5
      layers: [Dwgs.User]
      side: back
  right_switchplate:
    - what: outline
      name: right_combo
      extrude: 5
    - what: pcb
      name: /row_stagger_right.footprints.keys[12]/
      extrude: 5
      operation: subtract
      layers: [Eco2.User]
    - what: pcb
      name: /row_stagger_right.footprints.keys3/
      extrude: 5
      operation: subtract
      layers: [Dwgs.User]
    - what: pcb
      name: /row_stagger_right.footprints.stab/
      extrude: 5
      operation: subtract
      layers: [Dwgs.User]
    - what: pcb
      name: /row_stagger_right.modules.(charger|battery|jst-ph-battery-backup)/
      extrude: 5
      operation: subtract
      expand: 0.5
    - what: outline
      name: funnels
      extrude: 5
      operation: subtract
    - what: pcb
      name: /row_stagger_right.modules.(usb.USB_J1|power_switch.BAT_SW1)/
      extrude: 5
      operation: subtract
      layers: [Dwgs.User]
    - what: pcb
      name: /row_stagger_right.modules.e-paper.EPM_FPC1/
      extrude: 5
      operation: subtract
      expand: 0.5
      layers: [Dwgs.User]
      side: back
  right_gap:
    - what: outline
      name: right_case
      extrude: 5
    - what: outline
      name: right_board
      extrude: 5
      operation: subtract
    - what: outline
      name: funnels
      extrude: 5
      operation: subtract
    - what: outline
      name: right_studs
      extrude: 5
      operation: subtract
  right_bottom:
    - what: outline
      name: right_case
      extrude: 3
    - what: outline
      name: right_screws
      extrude: 3
      operation: subtract
    - what: outline
      name: funnels
      extrude: 3
      operation: subtract
    - what: pcb
      name: /row_stagger_right.modules.reset.RESRT_SW1/
      extrude: 3
      operation: subtract
      layers: [Dwgs.User]
      side: back

# How each half's case parts stack up round its board, from the bottom up: each part sits on the one below it, and
# the board's top is level with the top of the gap, the frame it lies in.
assemblies:
  row_stagger_left:
    stack: [left_bottom, left_gap, left_switchplate, left_middle, left_top]
    pcb:
      name: row_stagger_left
      top: left_gap
    parts:
      # the e-paper module (ErgoCai.modules e-paper/2.13inch) over the 18650 cell, on the socket's four holes: its
      # board's bottom at 30 mm, on 9 mm standoffs on the top plate (its top at 21), as on ErgoCai
      - name: e-paper
        model: "github:shiqi-614/ErgoCai.modules/e-paper/2.13inch/2.13inch.glb"
        at_module: e-paper
        z: 30
  row_stagger_right:
    stack: [right_bottom, right_gap, right_switchplate, right_middle, right_top]
    pcb:
      name: row_stagger_right
      top: right_gap
    parts:
      - name: e-paper
        model: "github:shiqi-614/ErgoCai.modules/e-paper/2.13inch/2.13inch.glb"
        at_module: e-paper
        z: 30
`
};

export default RowStaggerSplit;
