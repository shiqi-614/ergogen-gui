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
            shift: [0, -0.25kx]
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
          rows:
            row3:
            row2:
            row1:
        right:
          rows:
            row3:
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
        row3:        

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
          shift: [0.8px,2py - 8]
        - ref: matrix_col3_row1
          shift: [0.3px, 2py - 12.5]
        - ref: matrix_col3_row1
          shift: [0.3px, 2py - 7.5]
        - ref: matrix_col3_row1
          shift: [-0.3px, 2py - 7.5]
        - ref: matrix_col3_row1
          shift: [-0.3px, 2py - 12.5]
        - ref: matrix_col1_row1
          shift: [-0.7px, 2py - 7.5]
        - ref: matrix_col1_row1
          shift: [-0.7px, 2py - 2.5]
        - ref: matrix_col1_row1
          shift: [-1.26px, 2py - 2.5]
        - ref: matrix_col1_row1
          shift: [-1.26px, 2py - 7.5]
        - ref: matrix_col1_row1
          shift: [-1.55px, 2py - 7.5]
        - ref: matrix_col1_row4
          shift: [-1.55px,0.1py]
        - ref: thumbs_left_row3
          shift: [-0.6px,0.6py + 1]
        - ref: thumbs_left_row1
          shift: [-0.6px, -0.6py]
        - ref: matrix_col3_row5
          shift: [2,-0.7py - 5]
        - ref: matrix_col5_row5
          shift: [-0.5px,-0.7py]
        - ref: matrix_col6_row5
          shift: [0.8px + 0.25kx,-0.7py]
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
            file: "footprints/ErgoCai.pretty/SW_Hotswap_Kailh_MX_1.00u.kicad_mod"
        where: true
        meta:
          type: "key"
      keys2:
        what: 
          github:
            repo: "shiqi-614/ErgoCaiLib"
            file: "footprints/ErgoCai.pretty/SW_Hotswap_Kailh_MX_1.50u.kicad_mod"
        where: [matrix_col0_row2, matrix_col0_row4, matrix_col6_row1, matrix_col6_row2, matrix_col6_row3, matrix_col6_row4]
        meta:
          type: "key"
      keys3:
        what: 
          github:
            repo: "shiqi-614/ErgoCaiLib"
            file: "footprints/ErgoCai.pretty/SW_Hotswap_Kailh_MX_2.00u.kicad_mod"
        where: [thumbs_right_row2, thumbs_right_row1]
        meta:
          type: "key"
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
        meta:
          type: "diode"
      stab:
        what: 
          github:
            repo: "shiqi-614/ErgoCaiLib"
            file: "footprints/ErgoCai.pretty/STAB_MX_2u.kicad_mod"
        where: [thumbs_right_row1, thumbs_right_row2]
      joystick:
        what: 
          github:
            repo: "shiqi-614/ErgoCaiLib"
            file: "footprints/ErgoCai.pretty/Alpsalpine_RKJXV122400R.kicad_mod"
        where: [thumbs_right_row1]
        adjust:
          shift: [0, -24]
    modules:
      battery:
        what:
          github:
            repo: "shiqi-614/ErgoCai.modules"
            file: "battery/default_battery/default_battery.kicad_pcb"
        where:
          ref: [matrix_col5_row1]
          shift: [4.5, 22]
          rotate: 90
        footprints:
          BAT_SW1:
            where:
              ref: [matrix_col3_row1]
              shift: [0, 30]
      usb:
        what: 
          github:
            repo: "shiqi-614/ErgoCai.modules"
            file: "usb/default_usb/default_usb.kicad_pcb"
        where:
          ref: matrix_col1_row1
          shift: [-20.5, 34]
      mcu:
        what: 
          github:
            repo: "shiqi-614/ErgoCai.modules"
            file: "mcu/nRF52840_holyiot_18010/nRF52840_holyiot_18010.kicad_pcb"
        where:
          ref: matrix_col1_row1
          shift: [12, 24]
          rotate: 0
        footprints:
          MCU_SW1:
            where:
              ref: [matrix_col1_row1]
              shift: [28, 24]
    `
};

export default ErgoCaiRight;
