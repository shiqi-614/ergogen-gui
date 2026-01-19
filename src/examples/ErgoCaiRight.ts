import {ConfigExample} from "./index";

const ErgoCaiRight : ConfigExample = {
    label: "ErgoCai_Right",
    author: "jinsongc",
    value: `
units:
  kx: cx
  ky: cy
  px: kx + 3
  py: ky + 3
 
points:
  zones:
    matrix:
      columns: 
        col0: 
          key:
            stagger: -2.5
          rows.row5.skip: true
          rows.row3.skip: true
          rows.row2:
            width: 1.5kx
            rotate: 90
            shift: [0, -0.27kx]
          rows.row4:
            width: 1.5kx
            rotate: 90
            shift: [0, 0.25kx]
        col1:
          key:
            stagger: 0
          rows.row5.skip: true
        col2:
          key:
            stagger: 2.5
          rows.row5.skip: true 
        col3:
          key:
            stagger: 2.5
          rows.row5.skip: true 
        col4:
          key:  
            stagger: -2.5
        col5:
          key:
            stagger: -2.5

        col6:
          key:
            width: 1.5kx
            shift: [0.27kx, 0]
          rows:
            row5:
              width: 1kx
              shift: [0, 0]
      rows:
        row5:
        row4:
        row3:
        row2:
        row1:
    thumbs:
      anchor:
        ref: matrix_col1_row5
        shift: [-2.37kx, -2.2kx]
        rotate: 25
      columns:
        left:    
        right:
          rows:
            row2: 
              width: 2kx
              rotate: 90
              shift: [0kx, -0.54kx]
            row1:
              width: 2kx
              rotate: 90
              shift: [1.15kx, 0.52kx]
      rows:
        row1:
        row2:


outlines:
  raw:
    - what: rectangle
      where: true
      size: [kx, ky]
  keys:
    - what: rectangle
      where: true
      size: [kx-0.5,ky-0.5]
  board:
    - what: polygon
      operation: stack
      points:
        - ref: matrix_col6_row1
          shift: [0.8px, 1py]
        - ref: matrix_col3_row1
          shift: [0.3px, 1py - 5]
        - ref: matrix_col3_row1
          shift: [0.3px, 1py -2]
        - ref: matrix_col3_row1
          shift: [-0.3px, 1py-2]
        - ref: matrix_col3_row1
          shift: [-0.3px, 1py - 5]
        - ref: matrix_col1_row1
          shift: [-0.16px, 1py ]
        - ref: matrix_col1_row1
          shift: [-0.16px, 1py + 3]
        - ref: matrix_col1_row1
          shift: [-0.75px, 1py + 3]
        - ref: matrix_col1_row1
          shift: [-0.75px, 1py ]
        - ref: matrix_col1_row1
          shift: [-2.32px, 1py ]
        - ref: matrix_col1_row4
          shift: [-2.32px, -0.7py]
        - ref: matrix_col1_row4
          shift: [-2.32px, -1.3py]
        - ref: thumbs_left_row2
          shift: [-0.6px,0.6py + 1]
        - ref: thumbs_left_row1
          shift: [-0.6px, -0.6py]
        - ref: matrix_col4_row5
          shift: [-0.8px, -0.6py - 4.8]
        - ref: matrix_col6_row1
          shift: [0.8px , -5.0py + 0.46px]
      fillet: 1
  combo:
    - name: board
    - operation: subtract
      name: keys

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
        where: [matrix_col0_row2, matrix_col0_row4, matrix_col6_row1, matrix_col6_row2, matrix_col6_row3, matrix_col6_row4]
      keys3:
        what: 
          github:
            repo: "shiqi-614/ErgoCaiLib"
            file: "footprints/ErgoCai.pretty/SW_MX_HS_CPG151101S11_2u.kicad_mod"
        where: [thumbs_right_row2, thumbs_right_row1]
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
        where: [thumbs_right_row1, thumbs_right_row2]
    modules:
      led:
        what: 
          github:
            repo: "shiqi-614/ErgoCai.modules"
            file: "led/RBG_WS2812B_1/RBG_WS2812B_1.kicad_pcb"
        where: 
          ref: [matrix_col1_row4]
          shift: [-38, -15]
          rotate: 0
      charger:
        what:
          github:
            repo: "shiqi-614/ErgoCai.modules"
            file: "battery/TP4056_charger/TP4056_charger.kicad_pcb"
        where:
          ref: [matrix_col1_row4]
          shift: [-38.5, 10]
          rotate: 0
      e-paper:
        what:
          github:
            repo: "shiqi-614/ErgoCai.modules"
            file: "e-paper/1.02inch-e-Paper-socket/1.02inch-e-Paper-socket.kicad_pcb"
        where:
          ref: [matrix_col1_row1]
          shift: [-38, 16]
          rotate: -90
      power_switch:
        what:
          github:
            repo: "shiqi-614/ErgoCai.modules"
            file: "battery/power_switch_right/power_switch_right.kicad_pcb"
        where:
          ref: [matrix_col3_row1]
          shift: [-0, 15]
      joystick: 
        what: 
          github:
            repo: "shiqi-614/ErgoCai.modules"
            file: "joystick/JoystickMount/JoystickMount.kicad_pcb"
        where: 
          ref: [thumbs_right_row1]
          shift: [-7, -30]
          rotate: -90
      usb:
        what: 
          github:
            repo: "shiqi-614/ErgoCai.modules"
            file: "usb/default_usb/default_usb.kicad_pcb"
        where:
          ref: matrix_col1_row1
          shift: [-9.5, 20]
      mcu:
        what: 
          github: 
            repo: "shiqi-614/ErgoCai.modules"
            file: "mcu/nRF52840_holyiot_18010/nRF52840_holyiot_18010.kicad_pcb"
        where:
          ref: matrix_col1_row3
          shift: [-40, 26]
          rotate: 90 
      reset:
        what: 
          github: 
            repo: "shiqi-614/ErgoCai.modules"
            file: "reset/reset/reset.kicad_pcb"
        where: 
          ref: [matrix_col1_row3]
          shift: [-38, 5]
`
};

export default ErgoCaiRight;
