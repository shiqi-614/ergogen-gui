import {ConfigExample} from "./index";

const ErgoCaiRight : ConfigExample = {
    label: "ErgoCai_Right",
    author: "jinsongc",
    value: `
units:
  kx: u
  ky: u
  screwSize: 1.05
  studSize: 1.75
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
            shift: [0, -0.255kx]
          rows.row4:
            width: 1.5kx
            rotate: 90
            shift: [0, 0.24kx]
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
            shift: [0.255kx, 0]
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
              shift: [0kx, -0.5kx]  
            row1: 
              width: 2kx 
              rotate: 90
              shift: [1.08kx, 0.5kx]
      rows:
        row1:
        row2:

outlines:
  usb_and_swith:
    - what: polygon
      operation: stack
      points:
        - ref: matrix_col1_row1
          shift: [-9.5 + 25, 1ky + 14]
        - ref: matrix_col1_row1
          shift: [-9.5 + 5, 1ky + 7]
        - ref: matrix_col1_row1
          shift: [-9.5 - 5, 1ky + 7]
        - ref: matrix_col1_row1
          shift: [-9.5 - 25, 1ky + 14]
    - what: polygon
      operation: stack
      points:
        - ref: matrix_col3_row1
          shift: [0 + 25, 1ky + 12]
        - ref: matrix_col3_row1
          shift: [0 + 5, 1ky + 2]
        - ref: matrix_col3_row1
          shift: [0 - 5, 1ky + 2]
        - ref: matrix_col3_row1
          shift: [0 - 25, 1ky + 12.01]
  usb_and_swith_hole:
    - what: polygon
      operation: stack
      points:
        - ref: matrix_col1_row1
          shift: [-9.5 + 5.45, 1ky + 10]
        - ref: matrix_col1_row1
          shift: [-9.5 + 5.45, 1ky + 4]
        - ref: matrix_col1_row1
          shift: [-9.5 - 5.45, 1ky + 4]
        - ref: matrix_col1_row1
          shift: [-9.5 - 5.45, 1ky + 10]
    - what: polygon
      operation: stack
      points:
        - ref: matrix_col3_row1
          shift: [0 + 5.6, 1ky - 1]
        - ref: matrix_col3_row1
          shift: [0 + 5.6, 1ky + 3]
        - ref: matrix_col3_row1
          shift: [0 - 5.6, 1ky + 3]
        - ref: matrix_col3_row1
          shift: [0 - 5.6, 1ky - 1]
  cut: 
    - what: polygon
      operation: stack
      points:
        - ref: matrix_col6_row1
          shift: [0.8kx, 1ky + 11]
        - ref: matrix_col1_row1
          shift: [-2.7kx, 1ky + 11]
        - ref: matrix_col1_row1
          shift: [-2.7kx, 1ky + 15]
        - ref: matrix_col6_row1
          shift: [0.8kx, 1ky + 15]

  board:
    - what: polygon
      operation: stack
      points:
        - ref: matrix_col6_row1
          shift: [0.8kx, 1ky + 3]
        - ref: matrix_col3_row1
          shift: [0.3kx, 1ky - 2]
        - ref: matrix_col3_row1
          shift: [0.3kx, 1ky]
        - ref: matrix_col3_row1
          shift: [-0.3kx, 1ky]
        - ref: matrix_col3_row1
          shift: [-0.3kx, 1ky - 2]
        - ref: matrix_col1_row1
          shift: [-0.15kx, 1ky + 3]
        - ref: matrix_col1_row1
          shift: [-0.15kx, 1ky + 5]
        - ref: matrix_col1_row1
          shift: [-0.85kx, 1ky + 5]
        - ref: matrix_col1_row1
          shift: [-0.85kx, 1ky + 3]
        - ref: matrix_col1_row1
          shift: [-2.7kx, 1ky + 3]
        - ref: matrix_col1_row1
          shift: [-2.7kx, -4.5ky]
        - ref: thumbs_left_row2
          shift: [-0.65kx, 0.65ky]
        - ref: thumbs_left_row1
          shift: [-0.65kx, -0.65ky]
        - ref: matrix_col6_row1
          shift: [-2.8kx, -4.7ky]
        - ref: matrix_col6_row1
          shift: [0.8kx , -4.7ky]
      fillet: 0.9

  pcb_mounting_positions:
    pcb_pos1: 
      what: circle
      where: &pcb_pos1
        ref: [matrix_col0_row1]
        shift: [-1.55kx, 1ky]
    pcb_pos2: 
      what: circle
      where: &pcb_pos2
        ref: [matrix_col6_row1]
        shift: [0.65kx, 1ky]
    pcb_pos3: 
      what: circle
      where: &pcb_pos3
        ref: [matrix_col6_row5]
        shift: [0.9kx, -0.55ky]
    pcb_pos4: 
      what: circle
      where: &pcb_pos4
        ref: [matrix_col6_row5]
        shift: [-2.7kx, -0.55ky]
    pcb_pos5: 
      what: circle
      where: &pcb_pos5
        ref: [thumbs_left_row2]
        shift: [0.65kx, 0.75ky]

  pcb_stud_mounting: 
    - what: circle
      where:
        <<: *pcb_pos1
      radius: studSize
    - what: circle
      where:
        <<: *pcb_pos2
      radius: studSize
    - what: circle
      where:
        <<: *pcb_pos3
      radius: studSize
    - what: circle
      where:
        <<: *pcb_pos4
      radius: studSize
    - what: circle
      where:
        <<: *pcb_pos5
      radius: studSize

  pcb_screw_mounting: 
    - what: circle
      where:
        <<: *pcb_pos1
      radius: screwSize
    - what: circle
      where:
        <<: *pcb_pos2
      radius: screwSize
    - what: circle
      where:
        <<: *pcb_pos3
      radius: screwSize
    - what: circle
      where:
        <<: *pcb_pos4
      radius: screwSize
    - what: circle
      where:
        <<: *pcb_pos5
      radius: screwSize

  
  shell_mounting_positions: 
    matrix_top_right: &shell_pos1
      what: circle
      where:
        ref: [matrix_col6_row1]
        shift: [0.95kx, 1.25ky]
    matrix_top_left: &shell_pos2
      what: circle
      where: 
        ref: [matrix_col0_row1]
        shift: [-1.85kx, 1.25ky]
    matrix_bottom_right: &shell_pos3 
      what: circle
      where:
        ref: [matrix_col6_row5]
        shift: [1.2kx, -0.84ky]
    matrix_bottom_left: &shell_pos4
      what: circle
      where:
        ref: [matrix_col6_row5]
        shift: [-2.48kx, -0.9ky]
    thumb_upper: &shell_pos5
      what: circle
      where:
        ref: [thumbs_left_row2]
        shift: [-0.8kx, 0.75ky]
    thumb_lower: &shell_pos6
      what: circle
      where:
        ref: [thumbs_left_row1]
        shift: [-0.75kx, -0.77ky]

  stud_mounting:
    - <<: *shell_pos1
      radius: studSize
    - <<: *shell_pos2
      radius: studSize
    - <<: *shell_pos3
      radius: studSize
    - <<: *shell_pos4
      radius: studSize
    - <<: *shell_pos5
      radius: studSize
    - <<: *shell_pos6
      radius: studSize
  screw_mounting:
    - <<: *shell_pos1
      radius: screwSize
    - <<: *shell_pos2
      radius: screwSize
    - <<: *shell_pos3
      radius: screwSize
    - <<: *shell_pos4
      radius: screwSize
    - <<: *shell_pos5
      radius: screwSize
    - <<: *shell_pos6
      radius: screwSize 

  expand:
    - name: board
      expand: 8

  combo:
    - name: expand
    - operation: subtract
      name: stud_mounting
    

  reset_hole:
    - what: circle
      radius: 1.5 
      where:
        ref: [matrix_col0_row1]
        shift: [-21, -75]
  
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
      mount_hole1:
        what: 
          github:
            repo: "shiqi-614/ErgoCaiLib"
            file: "footprints/ErgoCai.pretty/MountingHole_2.2mm_M2_DIN965.kicad_mod"
        where: 
          <<: *pcb_pos1
      mount_hole2:
        what: 
          github:
            repo: "shiqi-614/ErgoCaiLib"
            file: "footprints/ErgoCai.pretty/MountingHole_2.2mm_M2_DIN965.kicad_mod"
        where: 
          <<: *pcb_pos2
      mount_hole3:
        what: 
          github:
            repo: "shiqi-614/ErgoCaiLib"
            file: "footprints/ErgoCai.pretty/MountingHole_2.2mm_M2_DIN965.kicad_mod"
        where: 
          <<: *pcb_pos3
      mount_hole4:
        what: 
          github:
            repo: "shiqi-614/ErgoCaiLib"
            file: "footprints/ErgoCai.pretty/MountingHole_2.2mm_M2_DIN965.kicad_mod"
        where: 
          <<: *pcb_pos4
      mount_hole5:
        what: 
          github:
            repo: "shiqi-614/ErgoCaiLib"
            file: "footprints/ErgoCai.pretty/MountingHole_2.2mm_M2_DIN965.kicad_mod"
        where: 
          <<: *pcb_pos5
    modules:
      charger:
        what:
          github:
            repo: "shiqi-614/ErgoCai.modules"
            file: "battery/TP4056_charger/TP4056_charger.kicad_pcb"
        where:
          ref: [matrix_col0_row1]
          shift: [-20, 0]
          rotate: 180
      e-paper:
        what: 
          github:
            repo: "shiqi-614/ErgoCai.modules"
            file: "e-paper/1.02inch-e-Paper-socket/1.02inch-e-Paper-socket.kicad_pcb"
        where:
          ref: [matrix_col0_row1]
          shift: [-21, -71.5]
          rotate: 90
      power_switch:
        what:
          github:
            repo: "shiqi-614/ErgoCai.modules"
            file: "battery/power_switch_right/power_switch_right.kicad_pcb"
        where:
          ref: [matrix_col3_row1]
          shift: [-0, 16.3]
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
          shift: [-9.5, 21.5]
      mcu:
        what: 
          github: 
            repo: "shiqi-614/ErgoCai.modules"
            file: "mcu/nRF52840_holyiot_18010/nRF52840_holyiot_18010.kicad_pcb"
        where:
          ref: matrix_col0_row1
          shift: [-23, -38]
          rotate: 90 
      reset:
        what: 
          github: 
            repo: "shiqi-614/ErgoCai.modules"
            file: "reset/reset/reset.kicad_pcb"
        where: 
          ref: [matrix_col0_row1]
          shift: [-21, -75]
cases:  
  top:
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
      name: /ergo_cai_right.footprints.keys/
      extrude: 3
      operation: subtract
      expand: 0.5
      layers: [Dwgs.User]
    - what: pcb
      name: /ergo_cai_right.modules.(joystick|e-paper)/
      extrude: 5
      operation: subtract
      expand: 0.6
    - what: pcb
      name: /ergo_cai_right.footprints.stab/
      expand: 0.5
      extrude: 5
      operation: subtract
      layers: [Dwgs.User]
    - what: outline
      name: pcb_screw_mounting
      extrude: 3
      operation: subtract
  middle:
    - what: outline
      name: combo
      extrude: 5
    - what: pcb
      name: /ergo_cai_right.footprints.keys/
      extrude: 5
      operation: subtract
      expand: 0.5
      layers: [Dwgs.User]
    - what: pcb
      name: /ergo_cai_right.footprints.stab/
      extrude: 5
      expand: 0.5
      operation: subtract
      layers: [Dwgs.User]
    - what: pcb
      name: /ergo_cai_right.modules.(joystick|e-paper|charger)/
      extrude: 5
      operation: subtract
      expand: 0.6
    - what: pcb
      name: /ergo_cai_right.modules.e-paper/
      shift: [0, 26, 0]
      extrude: 5
      operation: subtract
    - what: outline
      name: usb_and_swith
      extrude: 5
      operation: subtract
    - what: outline
      name: pcb_stud_mounting
      extrude: 5
      operation: subtract

  switchplate:
    - what: outline
      name: combo
      extrude: 5
    - what: pcb
      name: /ergo_cai_right.footprints.keys[12]/
      extrude: 5
      operation: subtract
    - what: pcb
      name: /ergo_cai_right.footprints.keys3/
      extrude: 5
      operation: subtract
      layers: [Dwgs.User]
    - what: pcb
      name: /ergo_cai_right.footprints.stab/
      extrude: 5
      operation: subtract
      layers: [Dwgs.User]
    - what: pcb
      name: /ergo_cai_right.modules.(usb|power_switch)/
      extrude: 5
      operation: subtract
      expand: 0.1
    - what: pcb
      name: /ergo_cai_right.modules.(joystick|e-paper|charger)/
      extrude: 5
      operation: subtract
      expand: 0.5
    - what: pcb
      name: /ergo_cai_right.modules.e-paper/
      shift: [0, 26, 0]
      extrude: 5
      operation: subtract
    - what: outline
      name: usb_and_swith
      extrude: 5
      operation: subtract
    - what: outline
      name: pcb_stud_mounting
      extrude: 5
      operation: subtract
    - what: outline
      name: usb_and_swith_hole
      extrude: 5
      operation: subtract

  gap: 
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

  buttom:
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
    - what: outline
      name: reset_hole
      extrude: 3
      operation: subtract
`
};

export default ErgoCaiRight;
