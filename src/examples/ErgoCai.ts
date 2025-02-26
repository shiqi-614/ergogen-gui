import {ConfigExample} from "./index";

const ErgoCai : ConfigExample = {
    label: "ErgoCai",
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
        outer:
          key:
            width: 1.5kx
            shift: [-0.02kx, 0]
          rows:
            mod:
              width: 1kx
              shift: [0.24kx, 0]
        pinky:
          key:
            spread: 1.3kx 
        ring:
          key:
            stagger: 5
        middle:
          key:
            stagger: 2.5
        index:
          key:
            stagger: -2.5
        inner:
          key:
            stagger: -2.5
          rows.mod.skip: true
      rows:
        mod:
        bottom:
        home:
        top:
        num:
    thumbs:
      anchor:
        ref: matrix_inner_mod
        shift: [0.43kx, -1.25kx]
        rotate: -25
      columns:
        left:
          rows:
            up.skip: true
            middle.skip: true
            down:
              width: 2kx
              rotate: -90
              shift: [0, 9.5]
        middle:
          rows:
            down:
              width: 2kx
              rotate: -90
              shift: [0, 9.5]
            middle.skip: true
            up: 
        right:
          rows:
            up:
            middle:
            down:

      rows:
        down:
        middle:
        up:        

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
        - ref: matrix_outer_num
          shift: [-0.8px,1py + 2.5]
        - ref: matrix_middle_num
          shift: [-0.3px, 1py - 5]
        - ref: matrix_middle_num
          shift: [-0.3px, 0.9 py]
        - ref: matrix_middle_num
          shift: [0.3px, 0.9py]
        - ref: matrix_middle_num
          shift: [0.3px, 1py - 5]
        - ref: matrix_inner_num
          shift: [0.7px, 1py ]
        - ref: matrix_inner_num
          shift: [0.7px, 1py + 3 ]
        - ref: matrix_inner_num
          shift: [1.26px, 1py + 3 ]
        - ref: matrix_inner_num
          shift: [1.26px, 1py ]
        - ref: matrix_inner_num
          shift: [1.55px, 1py]
        - ref: matrix_inner_bottom
          shift: [1.55px,0.2py]
        - ref: thumbs_right_up
          shift: [0.6px,0.6py + 1]
        - ref: thumbs_right_down
          shift: [0.6px,-0.6py]
        - ref: matrix_middle_mod
          shift: [4,-0.7py - 7.5]
        - ref: matrix_pinky_mod
          shift: [0.5px,-0.7py]
        - ref: matrix_outer_mod
          shift: [-0.8px - 0.25kx,-0.7py]
      fillet: 3
  combo:
    - name: board
    - operation: subtract
      name: keys

pcbs:
  ergo_cai: 
    outlines:
      main:
        outline: board
    footprints:
      SWA:
        what: 
          github:
            repo: "shiqi-614/ErgoCai.pretty"
            file: "SW_Hotswap_Kailh_MX_1.00u.kicad_mod"
        where: true
        meta:
          type: "key"
      SWB:
        what: "SW_Hotswap_Kailh_MX_1.50u.kicad_mod"
        where: [matrix_outer_num, matrix_outer_top, matrix_outer_home, matrix_outer_bottom]
        meta:
          type: "key"
      SWC:
        what: "SW_Hotswap_Kailh_MX_2.00u.kicad_mod"
        where: [thumbs_left_down, thumbs_middle_down]
        meta:
          type: "key"
      diodes:
        what: "Diode-Dual.kicad_mod"
        where: true
        adjust:
          shift: [0, -8.4]
          rotate: 180
        side: back
        meta:
          type: "diode"

    modules:
      battery:
        what:
          github:
            repo: "shiqi-614/ErgoCai.modules"
            file: "default_18650_AP2112K.yaml"
        where:
          ref: [matrix_inner_home]
          shift: [20.5, 10]
        footprints:
          BAT_SW1:
            where:
              ref: [matrix_middle_num]
              shift: [0, 16.2]
      charging:
        what: 
          github:
            repo: "shiqi-614/ErgoCai.modules"
            file: "default_TP4056.yaml"
        where:
          ref: matrix_index_num
          shift: [6, 13.5]
        side: back
      usb:
        what: 
          github:
            repo: "shiqi-614/ErgoCai.modules"
            file: "default_usb.yaml"
        where:
          ref: matrix_inner_num
          shift: [20.5, 20.5]
      mcu:
        what: 
          github:
            repo: "shiqi-614/ErgoCai.modules"
            file: "nRF52840_holyiot_18010.yaml"
        where:
          ref: matrix_inner_home
          shift: [23.5,12]
          rotate: 90
        side: back  
    `
};

export default ErgoCai;
