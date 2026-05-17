#version 300 es
precision highp float;

in vec3 vNormal;
in vec2 vUv;

uniform sampler2D blockAtlas;
uniform vec3 sunDirection;

out vec4 fragColor;

void main() {
  vec4 albedo = texture(blockAtlas, vUv);
  float light = clamp(dot(normalize(vNormal), normalize(sunDirection)) * 0.45 + 0.65, 0.25, 1.0);
  fragColor = vec4(pow(albedo.rgb * light, vec3(1.0 / 2.2)), albedo.a);
}
