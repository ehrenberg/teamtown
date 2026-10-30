"""
Generates the TeamTown base avatar (glTF binary) in Blender, headless and reproducible.

Usage (Blender 5.x):
  blender -b --factory-startup --python tools/blender/avatar.py -- \
      --output apps/web/public/assets/avatars/avatar.glb [--preview preview.png]

Style: docs/design/world-art-direction.md §4 (soft low-poly, adult proportions, flat facets).
The script is code (AGPL-3.0); the generated model is artwork (CC BY-SA 4.0, LICENSE-ASSETS).

Contract with the web client:
  - materials "Skin", "Hair", "Top", "Bottom", "Shoes", "Eyes"; the client tints "Top" per person
  - animations "Idle" and "Walk" (loopable)
  - Y-up, metres, the figure faces +Z in glTF, feet at y = 0
"""

import argparse
import math
import sys

import bmesh
import bpy
from mathutils import Vector

PALETTE = {
    "Skin": (0.878, 0.675, 0.541),
    "Hair": (0.290, 0.247, 0.212),
    "Top": (0.851, 0.396, 0.231),
    "Bottom": (0.227, 0.176, 0.149),
    "Shoes": (0.169, 0.122, 0.102),
    "Eyes": (0.169, 0.122, 0.102),
}
FPS = 24


def srgb_to_linear(channel):
    return channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--preview")
    return parser.parse_args(argv)


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.fps = FPS
    return scene


def make_materials():
    materials = {}
    for name, rgb in PALETTE.items():
        material = bpy.data.materials.new(name)
        material.use_nodes = True
        bsdf = material.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = (*[srgb_to_linear(c) for c in rgb], 1.0)
        bsdf.inputs["Roughness"].default_value = 0.85
        material.diffuse_color = (*[srgb_to_linear(c) for c in rgb], 1.0)  # viewport/preview colour
        materials[name] = material
    return materials


def finish_part(obj, material, bone, scale=None):
    """Applies transforms, assigns one material and binds all vertices rigidly to one bone."""
    if scale:
        obj.scale = scale
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    obj.select_set(False)
    obj.data.materials.append(material)
    group = obj.vertex_groups.new(name=bone)
    group.add(list(range(len(obj.data.vertices))), 1.0, "REPLACE")
    for polygon in obj.data.polygons:
        polygon.use_smooth = False
    return obj


def cylinder(radius, depth, location, vertices=8, radius_top=None):
    if radius_top is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
    else:
        bpy.ops.mesh.primitive_cone_add(
            vertices=vertices, radius1=radius, radius2=radius_top, depth=depth, location=location
        )
    return bpy.context.active_object


def ico(radius, location, subdivisions=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=radius, location=location)
    return bpy.context.active_object


def cube(size, location):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.active_object
    obj.scale = size
    return obj


def hair_cap(radius, center):
    """A faceted cap: the upper part of a sphere, cut back over the forehead so the face stays visible."""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=radius, location=center)
    obj = bpy.context.active_object
    mesh = bmesh.new()
    mesh.from_mesh(obj.data)
    doomed = [v for v in mesh.verts if v.co.z < -0.02 or (v.co.y < -radius * 0.55 and v.co.z < radius * 0.35)]
    bmesh.ops.delete(mesh, geom=doomed, context="VERTS")
    mesh.to_mesh(obj.data)
    mesh.free()
    return obj


def build_mesh(materials):
    m = materials
    # Proportions: about 1 : 4.5 head to body, friendly and stylised (art direction §4). Height ≈ 1.68 m.
    parts = [
        # Legs and shoes (Blender: Z up, the figure faces -Y)
        finish_part(cylinder(0.085, 0.68, (0.1, 0, 0.38)), m["Bottom"], "leg.L"),
        finish_part(cylinder(0.085, 0.68, (-0.1, 0, 0.38)), m["Bottom"], "leg.R"),
        finish_part(cube((0.14, 0.25, 0.09), (0.1, -0.035, 0.045)), m["Shoes"], "leg.L"),
        finish_part(cube((0.14, 0.25, 0.09), (-0.1, -0.035, 0.045)), m["Shoes"], "leg.R"),
        # Torso: tapered towards the hips and flattened, with a short neck
        finish_part(cylinder(0.2, 0.6, (0, 0, 1.0), radius_top=0.24), m["Top"], "spine", scale=(1, 0.7, 1)),
        finish_part(cylinder(0.06, 0.08, (0, 0, 1.33)), m["Skin"], "head"),
        # Head, hair and eyes
        finish_part(ico(0.17, (0, 0, 1.5)), m["Skin"], "head"),
        finish_part(hair_cap(0.182, (0, 0.014, 1.53)), m["Hair"], "head"),
        finish_part(cube((0.028, 0.012, 0.034), (0.055, -0.152, 1.515)), m["Eyes"], "head"),
        finish_part(cube((0.028, 0.012, 0.034), (-0.055, -0.152, 1.515)), m["Eyes"], "head"),
        # Arms with hands
        finish_part(cylinder(0.058, 0.52, (0.29, 0, 1.0), radius_top=0.066), m["Top"], "arm.L"),
        finish_part(cylinder(0.058, 0.52, (-0.29, 0, 1.0), radius_top=0.066), m["Top"], "arm.R"),
        finish_part(ico(0.062, (0.29, 0, 0.71)), m["Skin"], "arm.L"),
        finish_part(ico(0.062, (-0.29, 0, 0.71)), m["Skin"], "arm.R"),
    ]
    bpy.ops.object.select_all(action="DESELECT")
    for part in parts:
        part.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    body = bpy.context.active_object
    body.name = "Avatar"
    body.data.name = "Avatar"
    return body


def build_armature():
    bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
    armature = bpy.context.active_object
    armature.name = "Rig"
    bones = armature.data.edit_bones
    bones.remove(bones[0])

    def bone(name, head, tail, parent=None):
        edit_bone = bones.new(name)
        edit_bone.head = Vector(head)
        edit_bone.tail = Vector(tail)
        edit_bone.roll = 0
        if parent:
            edit_bone.parent = bones[parent]
        return edit_bone

    bone("hips", (0, 0, 0.72), (0, 0, 0.86))
    bone("spine", (0, 0, 0.86), (0, 0, 1.3), "hips")
    bone("head", (0, 0, 1.32), (0, 0, 1.7), "spine")
    bone("arm.L", (0.29, 0, 1.26), (0.29, 0, 0.68), "spine")
    bone("arm.R", (-0.29, 0, 1.26), (-0.29, 0, 0.68), "spine")
    bone("leg.L", (0.1, 0, 0.72), (0.1, 0, 0.04), "hips")
    bone("leg.R", (-0.1, 0, 0.72), (-0.1, 0, 0.04), "hips")
    bpy.ops.object.mode_set(mode="OBJECT")
    return armature


def bind(body, armature):
    body.parent = armature
    modifier = body.modifiers.new("Armature", "ARMATURE")
    modifier.object = armature


def key_rotation(pose_bone, frame, degrees_x=0.0, degrees_z=0.0):
    pose_bone.rotation_mode = "XYZ"
    pose_bone.rotation_euler = (math.radians(degrees_x), 0.0, math.radians(degrees_z))
    pose_bone.keyframe_insert(data_path="rotation_euler", frame=frame)


def key_lift(pose_bone, frame, metres):
    # Bone-local Y points along the bone; the hips bone points up, so local Y is world up.
    pose_bone.location = (0.0, metres, 0.0)
    pose_bone.keyframe_insert(data_path="location", frame=frame)


def make_action(armature, name, frames, keyframes):
    """Records one looping action and pushes it onto its own NLA track (exported as a glTF animation)."""
    armature.animation_data_create()
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    armature.animation_data.action = action
    pose = armature.pose.bones
    for pose_bone in pose:
        pose_bone.rotation_mode = "XYZ"
        pose_bone.rotation_euler = (0, 0, 0)
        pose_bone.location = (0, 0, 0)
    keyframes(pose)
    track = armature.animation_data.nla_tracks.new()
    track.name = name
    track.strips.new(name, 1, action)
    armature.animation_data.action = None
    return action


def walk(pose):
    # One stride cycle: 20 frames at 24 fps ≈ 0.83 s, matching about 1.5 m/s walking speed.
    swing = 26
    for frame, phase in [(1, 1), (6, 0), (11, -1), (16, 0), (21, 1)]:
        key_rotation(pose["leg.L"], frame, swing * phase)
        key_rotation(pose["leg.R"], frame, -swing * phase)
        key_rotation(pose["arm.L"], frame, -0.8 * swing * phase)
        key_rotation(pose["arm.R"], frame, 0.8 * swing * phase)
        key_rotation(pose["spine"], frame, 0, 3 * phase)
        key_lift(pose["hips"], frame, 0.0 if phase != 0 else 0.03)


def idle(pose):
    # Calm breathing: 48 frames = 2 s.
    for frame, phase in [(1, 0.0), (25, 1.0), (49, 0.0)]:
        key_rotation(pose["spine"], frame, -2.5 * phase)
        key_rotation(pose["head"], frame, 2.0 * phase)
        key_rotation(pose["arm.L"], frame, 0, 2.5 * phase)
        key_rotation(pose["arm.R"], frame, 0, -2.5 * phase)
        key_lift(pose["hips"], frame, 0.006 * phase)


def export(path):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        export_yup=True,
        export_apply=False,
        export_skins=True,
        export_animations=True,
        export_animation_mode="NLA_TRACKS",
        export_materials="EXPORT",
    )


def render_preview(path):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "MATERIAL"
    scene.display.shading.show_shadows = True
    scene.render.resolution_x = 640
    scene.render.resolution_y = 640
    scene.render.film_transparent = False
    scene.world = bpy.data.worlds.new("World")
    scene.world.color = (0.96, 0.93, 0.88)
    bpy.ops.object.camera_add(location=(2.6, -2.6, 2.4))
    camera = bpy.context.active_object
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 2.2
    direction = Vector((0, 0, 0.85)) - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.camera = camera
    scene.frame_set(1)
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def main():
    args = parse_args()
    reset_scene()
    materials = make_materials()
    body = build_mesh(materials)
    armature = build_armature()
    bind(body, armature)
    make_action(armature, "Idle", 49, idle)
    make_action(armature, "Walk", 21, walk)
    export(args.output)
    print(f"Exported {args.output}")
    if args.preview:
        render_preview(args.preview)
        print(f"Rendered preview {args.preview}")


main()
