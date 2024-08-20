import {ConfigExample} from "./index";

const ErgoCai : ConfigExample = {
    label: "ErgoCai",
    author: "jinsongc",
    value: `
points:
  zones:
    matrix:
      columns:
        outer:
          key:
            width: 1.5kx
            column_net: C0
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
        shift: [0 + 8, -1kx - 4]
        rotate: -25
      columns:
        left:
          key.column_net: C1
          rows:
            down:
              row_net: R5
              width: 2kx
              rotate: -90
              shift: [0kx, 0.5kx]
            middle.skip: true
            up.skip: true
        middle:
          key.column_net: C2
          rows:
            down:
              row_net: R5
              width: 2kx
              rotate: -90
              shift: [0kx, 0.5kx]    
            middle.skip: true
            up: 
              column_net: C5 
              row_net: R4
              rotate: 90
              shift: [-1.6kx, -2.1kx]       
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
units:
  kx: cx
  ky: cy
  px: kx + 3
  py: ky + 3
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
          shift: [1.5px, 1py]
        - ref: matrix_inner_bottom
          shift: [1.5px,0.2py]
        - ref: thumbs_right_up
          shift: [0.6px,0.6py + 1]
        - ref: thumbs_right_down
          shift: [0.6px,-0.6py]
        - ref: matrix_middle_mod
          shift: [4,-0.7py - 7.5]
        - ref: matrix_pinky_mod
          shift: [0.5px,-0.7py]
        - ref: matrix_outer_mod
          shift: [-0.8px,-0.7py]
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
      keys:
        what: mx
        where: true
        params:
          from: "{{row_net}}"
          to: "{{column_net}}"
          keycaps: true
      diodes:
        what: diode
        where: true
        adjust:
          shift: [0, -4.7]
        params:
          from: "{{row_net}}"
          to: "{{colrow}}"
    `
};

export default ErgoCai;
