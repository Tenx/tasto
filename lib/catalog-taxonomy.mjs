export const MENU_CHOICES = [
  ['minimal_modern/swiss_style', 'Minimal & Modern · 现代极简 / Swiss Style · 瑞士国际主义风格'],
  ['minimal_modern/swiss_geometric', 'Minimal & Modern · 现代极简 / Swiss Geometric · 瑞士几何风格'],
  ['minimal_modern/swiss_typo_bw', 'Minimal & Modern · 现代极简 / Swiss Typographic · 瑞士黑白字体'],
  ['minimal_modern/swiss_dots_color', 'Minimal & Modern · 现代极简 / Swiss Dots & Color · 瑞士圆点色彩'],
  ['minimal_modern/editorial_min', 'Minimal & Modern · 现代极简 / Editorial Minimal · 编辑式极简'],
  ['minimal_modern/tech_min', 'Minimal & Modern · 现代极简 / Tech Minimal · 科技极简'],
  ['minimal_modern/warm_min', 'Minimal & Modern · 现代极简 / Warm Minimal · 温暖极简'],
  ['minimal_modern/luxury_min', 'Minimal & Modern · 现代极简 / Luxury Minimal · 奢华极简'],
  ['minimal_modern/velvet_luxe', 'Minimal & Modern · 现代极简 / Velvet Luxe · 丝绒奢华'],
  ['minimal_modern/monochrome', 'Minimal & Modern · 现代极简 / Monochrome · 单色主义'],
  ['graphic/neo_brutalism', 'Graphic & Experimental · 图形与实验 / Neo-Brutalism · 新粗野主义'],
  ['graphic/anti_design', 'Graphic & Experimental · 图形与实验 / Anti-Design · 反设计'],
  ['graphic/maximalism', 'Graphic & Experimental · 图形与实验 / Maximalism · 极繁主义'],
  ['graphic/memphis', 'Graphic & Experimental · 图形与实验 / Memphis · 孟菲斯风格'],
  ['graphic/glitch', 'Graphic & Experimental · 图形与实验 / Glitch Art · 故障艺术'],
  ['graphic/kinetic_typo', 'Graphic & Experimental · 图形与实验 / Kinetic Typography · 动态字体'],
  ['graphic/surreal_3d', 'Graphic & Experimental · 图形与实验 / Surreal 3D · 超现实三维'],
  ['material/glassmorphism', 'Material · 材质风格 / Liquid Glass · 液态玻璃'],
  ['material/aurora_gradient', 'Material · 材质风格 / Aurora Gradient · 极光渐变'],
  ['material/claymorphism', 'Material · 材质风格 / Claymorphism · 黏土拟态'],
  ['material/frosted_depth', 'Material · 材质风格 / Frosted Depth · 磨砂空间'],
  ['material/neumorphism', 'Material · 材质风格 / Neumorphism · 柔性拟态'],
  ['material/paper_cutout', 'Material · 材质风格 / Paper / Cutout · 纸张拼贴'],
  ['futuristic/cyberpunk', 'Futuristic · 未来科技 / Cyberpunk · 赛博朋克'],
  ['futuristic/neon_skyport', 'Futuristic · 未来科技 / Neon Skyport · 霓虹空港'],
  ['futuristic/dark_tech', 'Futuristic · 未来科技 / Dark Technology · 暗黑科技'],
  ['futuristic/scifi_hud', 'Futuristic · 未来科技 / Sci-Fi HUD · 科幻界面'],
  ['cinematic/cinematic', 'Cinematic & Narrative · 影视叙事 / Cinematic Dark · 电影感暗色'],
  ['cinematic/film_noir', 'Cinematic & Narrative · 影视叙事 / Film Noir · 黑色电影'],
  ['cinematic/cinematic_editorial', 'Cinematic & Narrative · 影视叙事 / Cinematic Editorial · 电影感编辑设计'],
  ['retro/bauhaus', 'Retro & Era · 复古与时代 / Bauhaus · 包豪斯风格'],
  ['retro/synthwave', 'Retro & Era · 复古与时代 / Synthwave · 合成波'],
  ['retro/y2k', 'Retro & Era · 复古与时代 / Y2K · 千禧年风格'],
  ['retro/cassette_fut', 'Retro & Era · 复古与时代 / Retro Futurism · 复古未来主义'],
  ['organic/organic_modern', 'Organic & Humanistic · 自然与人文 / Organic Modern · 有机现代主义'],
  ['organic/biophilic', 'Organic & Humanistic · 自然与人文 / Biophilic · 亲生命设计'],
  ['organic/wabi_sabi', 'Organic & Humanistic · 自然与人文 / Wabi-Sabi · 侘寂'],
  ['organic/ethereal', 'Organic & Humanistic · 自然与人文 / Ethereal · 空灵风格']
];

export const MENU_PATHS = new Set(MENU_CHOICES.map(([value]) => value));

export function isValidMenuPath(value) {
  return typeof value === 'string' && MENU_PATHS.has(value);
}
