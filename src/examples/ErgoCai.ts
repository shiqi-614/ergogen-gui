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
            column_net: C0
            shift: [-0.02kx, 0]
          rows:
            mod:
              width: 1kx
              shift: [0.24kx, 0]
        pinky:
          key:
            spread: 1.3kx 
            column_net: C1
        ring:
          key:
            stagger: 5
            column_net: C2
        middle:
          key:
            stagger: 2.5
            column_net: C3
        index:
          key:
            stagger: -2.5
            column_net: C4
        inner:
          key:
            stagger: -2.5
            column_net: C5
          rows.mod.skip: true
      rows:
        mod:
          row_net: R4
        bottom:
          row_net: R3
        home:
          row_net: R2
        top:
          row_net: R1
        num:
          row_net: R0
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
          key.column_net: C2
          rows:
            down:
              width: 2kx
              rotate: -90
              shift: [0, 9.5]
            middle.skip: true
            up: 
              column_net: C5 
              row_net: R4 
        right:
          rows:
            up:
              column_net: C5
              row_net: R5
            middle:
              column_net: C4
              row_net: R5
            down:
              column_net: C3
              row_net: R5
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
      keys1:
        what: SW_Hotswap_Kailh_MX_1.00u
        where: /matrix_.*/
      keys2:
        what: SW_Hotswap_Kailh_MX_1.00u
        where: /thumbs_.*/
      keys3:
        what: SW_Hotswap_Kailh_MX_2.00u
        where: [thumbs_left_down, thumbs_middle_down]
      keys4:
        what: SW_Hotswap_Kailh_MX_1.50u
        where: [matrix_outer_num, matrix_outer_top, matrix_outer_home, matrix_outer_bottom]
      diodes:
        what: Diode-Dual
        where: true
        adjust:
          shift: [0, -8.4]
        side: Back
      battery:
        what: Battery_Holder_18650_Nickel
        where:
          ref.aggregate.parts: [matrix_inner_home]
          shift: [20.5,10]
      switch:
        what: MSK-12C02
        where:
          ref.aggregate.parts: [matrix_middle_num]
          shift: [0,16.2]
      LED_RGB:
        what: LED_RGB_5050-6
        where:
          ref.aggregate.parts: [matrix_inner_num]
          shift: [0,15]
      blue:
        what: LED_0603_1608Metric
        where:
          ref.aggregate.parts: [matrix_inner_num]
          shift: [12.5,15]
          rotate: 90
      red:
        what: LED_0603_1608Metric
        where:
          ref.aggregate.parts: [matrix_inner_num]
          shift: [28.5,15]
          rotate: 90
      usb_c:
        what: USB_C_Receptacle_HRO_TYPE-C-31-M-12
        where:
          ref.aggregate.parts: [matrix_inner_num]
          shift: [20.5,20.5]
          rotate: 180
      nrf52840:
        what: nRF52840_holyiot_18010
        where:
          ref.aggregate.parts: [matrix_inner_home]
          shift: [23.5,12]
          rotate: -90
        side: Back
      reset:
        what: K2-1187SQ
        where:
          ref.aggregate.parts: [matrix_inner_home]
          shift: [20.5, -5]
          rotate: 0
        side: Back
      connector:
        what: Connector_THT_1x4_2.54
        where:
          ref.aggregate.parts: [matrix_inner_num]
          shift: [31, -8]
    
    `
};

export default ErgoCai;
