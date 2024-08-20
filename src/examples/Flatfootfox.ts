import {ConfigExample} from "./index";

const Flatfootfox: ConfigExample = {
    label: "Flatfootfox",
    author: "Flatfootfox",
    value: `
units:
  # Proxy Spacing Variables
  kx: cx
  ky: cy
  # Padding Variables
  px: kx + 4
  py: ky + 4
points:
  zones:
    # The primary 6x4 key matrix, plus 3 modifiers.
    matrix:
      # Position in center of KiCAD workspace.
      anchor:
        shift: [100, -100]
      # Choc spacing
      key:
        padding: 1ky
        spread: 1kx
      columns:
        # Hide the first two mods and the last mod.
        # Provide a Sofle-like column stagger.
        outer:
          rows.mod.skip: true
          key.column_net: P14
        pinky:
          rows.mod.skip: true
          key.column_net: P16
        ring:
          key:
            stagger: 5
            column_net: P10
          rows.mod.column_net: P16
        middle:
          key:
            stagger: 2.5
            column_net: P7
          rows.mod.column_net: P10
        index:
          key:
            stagger: -2.5
            column_net: P8
          rows.mod.column_net: P7
        inner:
          rows.mod.skip: true
          key:
            stagger: -2.5
            column_net: P9
      rows:
        # Four main rows, one partial row.
        mod:
          row_net: P15
          mirror.row_net: P6
        bottom:
          row_net: P18
          mirror.row_net: P5
        home:
          row_net: P19
          mirror.row_net: P4
        top:
          row_net: P20
          mirror.row_net: P0
        num:
          row_net: P21
          mirror.row_net: P1
    # Thumb cluster for Layer and Space keys.
    thumbs:
      # Choc spacing
      key:
        padding: 1ky
        spread: 1kx
      # Place thumbs where the inner mod would go.
      anchor:
        ref: matrix_inner_mod
        shift: [2, -2]
      columns:
        # Fan thumbs out by -15 degrees.
        layer:
          key:
            splay: -15
            column_net: P8
        # Spacebar uses a 1.5 wide key.
        space:
          key:
            width: 1.5kx
            splay: 75
            shift: [2.5,-3.25]
            column_net: P9
      rows:
        # Thumbs only have one row.
        cluster:
          row_net: P15
          mirror.row_net: P6
  # Mirror keyboard halves with a moderate rotation.
  rotate: -20
  mirror: &mirror
    ref: matrix_inner_num
    distance: 2kx
outlines:
  # Pure key outline.
  raw:
    - what: rectangle
      where: true
      size: [px, py]
  # Key outlines with 0.5mm removed to show key overlaps.
  keys:
    - what: rectangle
      where: true
      size: [kx-0.5,ky-0.5]
  # PCB board outline.
  board:
    - what: polygon
      operation: stack
      points:
        - ref: matrix_outer_num
          shift: [-0.5px,0.5py]
        - ref: matrix_ring_num
          shift: [-0.5px,0.5py]
        - ref: matrix_middle_num
          shift: [-0.5px,0.5py]
        - ref: matrix_middle_num
          shift: [0.5px,0.5py]
        - ref: matrix_inner_num
          shift: [0.5px,0.5py]
        - ref: matrix_inner_top
          shift: [0.5px,0.5py]
        - ref: mirror_matrix_inner_top
          shift: [0.5px,0.5py]
        - ref: mirror_matrix_inner_num
          shift: [0.5px,0.5py]
        - ref: mirror_matrix_middle_num
          shift: [0.5px,0.5py]
        - ref: mirror_matrix_middle_num
          shift: [-0.5px,0.5py]
        - ref: mirror_matrix_ring_num
          shift: [-0.5px,0.5py]
        - ref: mirror_matrix_outer_num
          shift: [-0.5px,0.5py]
        - ref: mirror_matrix_outer_bottom
          shift: [-0.5px,-0.5py]
        - ref: mirror_matrix_ring_mod
          shift: [-0.5px,-0.5py]
        - ref: mirror_thumbs_layer_cluster
          shift: [-0.5px,-0.5py]
        - ref: mirror_thumbs_space_cluster
          shift: [-0.5py,-0.5px]
        - ref: mirror_thumbs_space_cluster
          shift: [0.5py,-0.5px]
        - ref: thumbs_space_cluster
          shift: [0.5py,-0.5px]
        - ref: thumbs_space_cluster
          shift: [-0.5py,-0.5px]
        - ref: thumbs_layer_cluster
          shift: [-0.5px,-0.5py]
        - ref: matrix_ring_mod
          shift: [-0.5px,-0.5py]
        - ref: matrix_outer_bottom
          shift: [-0.5px,-0.5py]
      fillet: 2
  # Combination preview showing outline and keys.
  combo:
    - name: board
    - operation: subtract
      name: keys
pcbs:
  tutorial:
    outlines:
      main:
        outline: board
    footprints:
      # Hotswap Choc keys.
      choc_hotswap:
        what: choc
        where: true
        params:
          keycaps: true
          reverse: false
          hotswap: true
          from: "{{column_net}}"
          to: "{{colrow}}"
      # Through Hole or SMD Diodes
      diode:
        what: diode
        where: true
        params:
          from: "{{colrow}}"
          to: "{{row_net}}"
        adjust:
          shift: [0, -5]
      # Face Down Arduino Pro Micro
      promicro:
        what: promicro
        params:
          orientation: "down"
        where:
          ref.aggregate.parts: [matrix_inner_home, mirror_matrix_inner_home]
          shift: [0,0]
          rotate: -90
      # OLED Screen
      oled:
        what: oled
        params:
          side: "F"
          SDA: P2
          SCL: P3
        where:
          ref.aggregate.parts: [matrix_inner_home, mirror_matrix_inner_home]
          shift: [-6,-19]
          rotate: 90
      # Four Pin Reset Button
      reset:
        what: button
        params:
          from: GND
          to: RST
        where:
          ref.aggregate.parts: [matrix_index_mod, mirror_matrix_index_mod]
          shift: [0, -1]
          rotate: -90
    `
};

export default Flatfootfox;
