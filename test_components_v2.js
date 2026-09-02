/**
 * ============================================================================
 * TEST SUITE: DISCORD COMPONENTS V2 ENGINE & BUILDERS
 * ============================================================================
 * Comprehensive unit test verification for Discord Components V2 Engine:
 * - Constants & Enums verification (ComponentType, MessageFlags, SeparatorSpacingSize, ButtonStyle, Colors)
 * - Color Converter & Resolver (Hex '#5865F2' -> 0x5865F2, RGB strings, RGB arrays/objects, presets & fallback)
 * - TextDisplayBuilder .toJSON()
 * - SeparatorBuilder .toJSON()
 * - ThumbnailBuilder .toJSON()
 * - MediaGalleryBuilder & MediaGalleryItemBuilder .toJSON()
 * - FileBuilder .toJSON()
 * - ButtonBuilder & StringSelectMenuBuilder .toJSON()
 * - SectionBuilder (with Button, Select, Thumbnail accessories) .toJSON()
 * - ActionRowBuilder .toJSON()
 * - ContainerBuilder (accent colors, spoilers, child component hierarchy) .toJSON()
 * - fromJSON() factory & bidirectional round-tripping
 * - createComponentPayload() integration helper
 * - Dual-Mode Payload Generation (V2 Container vs Legacy V1 Embeds)
 * - Bidirectional Conversion (convertLegacyToComponentsV2 & convertComponentsV2ToLegacy)
 * - Interaction event handling simulation on V2 accessories and action rows
 * ============================================================================
 */

'use strict';

const assert = require('assert');
const {
  ComponentType,
  MessageFlags,
  SeparatorSpacingSize,
  ButtonStyle,
  Colors,
  BaseComponentBuilder,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ThumbnailBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  FileBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  resolveColor,
  convertAccentColor,
  normalizeEmoji,
  fromJSON,
  createComponentPayload,
  createDualModePayload,
  convertLegacyToComponentsV2,
  convertComponentsV2ToLegacy,
  isComponentsV2Payload,
} = require('./components_v2.js');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  \x1b[32m✔\x1b[0m [PASS] ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  \x1b[31m✖\x1b[0m [FAIL] ${name}`);
    console.error(`    ${err.message}\n${err.stack}`);
  }
}

async function testAsync(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  \x1b[32m✔\x1b[0m [PASS] ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  \x1b[31m✖\x1b[0m [FAIL] ${name}`);
    console.error(`    ${err.message}\n${err.stack}`);
  }
}

async function runAllTests() {
  console.log('\n================================================================');
  console.log('⚡ RUNNING DISCORD COMPONENTS V2 COMPREHENSIVE TEST SUITE');
  console.log('================================================================\n');

  // ----------------------------------------------------------------------------
  // 1. ENUMS & CONSTANTS
  // ----------------------------------------------------------------------------
  console.log('\x1b[36m[Group 1: Enums & Constants]\x1b[0m');

  test('ComponentType has correct Discord V2 integer mappings', () => {
    assert.strictEqual(ComponentType.ActionRow, 1);
    assert.strictEqual(ComponentType.Button, 2);
    assert.strictEqual(ComponentType.StringSelect, 3);
    assert.strictEqual(ComponentType.UserSelect, 5);
    assert.strictEqual(ComponentType.RoleSelect, 6);
    assert.strictEqual(ComponentType.MentionableSelect, 7);
    assert.strictEqual(ComponentType.ChannelSelect, 8);
    assert.strictEqual(ComponentType.Section, 9);
    assert.strictEqual(ComponentType.TextDisplay, 10);
    assert.strictEqual(ComponentType.Thumbnail, 11);
    assert.strictEqual(ComponentType.MediaGallery, 12);
    assert.strictEqual(ComponentType.File, 13);
    assert.strictEqual(ComponentType.Separator, 14);
    assert.strictEqual(ComponentType.Container, 17);
  });

  test('MessageFlags.IsComponentsV2 equals 32768 (1 << 15) and bitwise flag combinations', () => {
    assert.strictEqual(MessageFlags.IsComponentsV2, 32768);
    assert.strictEqual(MessageFlags.IsComponentsV2, 1 << 15);
    assert.strictEqual(MessageFlags.Ephemeral, 64);
    assert.strictEqual(MessageFlags.SuppressEmbeds, 4);

    // Bitwise combination with Ephemeral
    const ephemeralV2 = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
    assert.strictEqual(ephemeralV2, 32832);
    assert.strictEqual(Boolean(ephemeralV2 & MessageFlags.Ephemeral), true);
    assert.strictEqual(Boolean(ephemeralV2 & MessageFlags.IsComponentsV2), true);

    // Bitwise combination with SuppressNotifications
    const quietV2 = MessageFlags.SuppressNotifications | MessageFlags.IsComponentsV2;
    assert.strictEqual(quietV2, 36864);
    assert.strictEqual(Boolean(quietV2 & MessageFlags.SuppressNotifications), true);
  });

  test('SeparatorSpacingSize has Small(1) and Large(2)', () => {
    assert.strictEqual(SeparatorSpacingSize.Small, 1);
    assert.strictEqual(SeparatorSpacingSize.Large, 2);
  });

  test('ButtonStyle has correct Discord API mappings', () => {
    assert.strictEqual(ButtonStyle.Primary, 1);
    assert.strictEqual(ButtonStyle.Secondary, 2);
    assert.strictEqual(ButtonStyle.Success, 3);
    assert.strictEqual(ButtonStyle.Danger, 4);
    assert.strictEqual(ButtonStyle.Link, 5);
    assert.strictEqual(ButtonStyle.Premium, 6);
  });

  // ----------------------------------------------------------------------------
  // 2. ACCENT COLOR CONVERSION & RESOLUTION
  // ----------------------------------------------------------------------------
  console.log('\n\x1b[36m[Group 2: Accent Color Conversion & Resolution]\x1b[0m');

  test('resolveColor handles hex strings (#5865F2, 5865F2, 0x5865F2, #FFF)', () => {
    assert.strictEqual(resolveColor('#5865F2'), 0x5865f2);
    assert.strictEqual(resolveColor('5865F2'), 0x5865f2);
    assert.strictEqual(resolveColor('0x5865F2'), 0x5865f2);
    assert.strictEqual(resolveColor('#FFFFFF'), 0xffffff);
    assert.strictEqual(resolveColor('#fff'), 0xffffff);
    assert.strictEqual(resolveColor('#000'), 0x000000);
  });

  test('resolveColor handles named preset colors (Blurple, Green, Red, Gold, etc.)', () => {
    assert.strictEqual(resolveColor('Blurple'), Colors.Blurple);
    assert.strictEqual(resolveColor('blurple'), Colors.Blurple);
    assert.strictEqual(resolveColor('Green'), Colors.Green);
    assert.strictEqual(resolveColor('red'), Colors.Red);
    assert.strictEqual(resolveColor('Gold'), Colors.Gold);
  });

  test('resolveColor handles integers and RGB arrays/objects', () => {
    assert.strictEqual(resolveColor(0x5865f2), 0x5865f2);
    assert.strictEqual(resolveColor([88, 101, 242]), 0x5865f2);
    assert.strictEqual(resolveColor({ r: 88, g: 101, b: 242 }), 0x5865f2);
    assert.strictEqual(resolveColor(null), 0);
    assert.strictEqual(resolveColor(undefined), 0);
  });

  test('resolveColor throws error on invalid color strings or out of range', () => {
    assert.throws(() => resolveColor('invalid_color_xyz'), TypeError);
    assert.throws(() => resolveColor(-1), RangeError);
    assert.throws(() => resolveColor(0x1000000), RangeError);
  });

  test('convertAccentColor gracefully converts hex, rgb, and invalid fallback without throwing', () => {
    // Hex
    assert.strictEqual(convertAccentColor('#5865F2'), 0x5865f2);
    assert.strictEqual(convertAccentColor('0x5865F2'), 0x5865f2);
    assert.strictEqual(convertAccentColor('5865F2'), 0x5865f2);
    assert.strictEqual(convertAccentColor('#00E676'), 0x00e676);
    assert.strictEqual(convertAccentColor('#ED4245'), 0xed4245);
    assert.strictEqual(convertAccentColor('#FFF'), 0xffffff);

    // RGB Strings
    assert.strictEqual(convertAccentColor('rgb(88, 101, 242)'), 0x5865f2);
    assert.strictEqual(convertAccentColor('rgba(88, 101, 242, 1)'), 0x5865f2);
    assert.strictEqual(convertAccentColor('rgb(0, 230, 118)'), 0x00e676);

    // Arrays and Objects
    assert.strictEqual(convertAccentColor([88, 101, 242]), 0x5865f2);
    assert.strictEqual(convertAccentColor({ r: 88, g: 101, b: 242 }), 0x5865f2);

    // Preset Names
    assert.strictEqual(convertAccentColor('Blurple'), 0x5865f2);
    assert.strictEqual(convertAccentColor('Green'), 0x57f287);

    // Integers
    assert.strictEqual(convertAccentColor(0x5865f2), 0x5865f2);
    assert.strictEqual(convertAccentColor(0), 0);

    // Invalid Fallbacks
    assert.strictEqual(convertAccentColor('invalid_color'), 0x5865f2);
    assert.strictEqual(convertAccentColor(null), 0x5865f2);
    assert.strictEqual(convertAccentColor(undefined), 0x5865f2);
    assert.strictEqual(convertAccentColor(-1), 0x5865f2);
    assert.strictEqual(convertAccentColor(0x1000000), 0x5865f2);
    assert.strictEqual(convertAccentColor(NaN), 0x5865f2);
    assert.strictEqual(convertAccentColor(Infinity), 0x5865f2);
    assert.strictEqual(convertAccentColor({}, 0x00E676), 0x00e676);
  });

  test('normalizeEmoji handles unicode and custom discord emojis', () => {
    assert.deepStrictEqual(normalizeEmoji('🔥'), { name: '🔥', id: null });
    assert.deepStrictEqual(normalizeEmoji('<:pepe:123456789>'), { animated: false, name: 'pepe', id: '123456789' });
    assert.deepStrictEqual(normalizeEmoji('<a:vibing:987654321>'), { animated: true, name: 'vibing', id: '987654321' });
    assert.deepStrictEqual(normalizeEmoji({ name: 'custom', id: '111', animated: true }), { name: 'custom', id: '111', animated: true });
    assert.strictEqual(normalizeEmoji(null), undefined);
  });

  // ----------------------------------------------------------------------------
  // 3. TEXT DISPLAY BUILDER (Type 10)
  // ----------------------------------------------------------------------------
  console.log('\n\x1b[36m[Group 3: TextDisplayBuilder]\x1b[0m');

  test('TextDisplayBuilder generates correct JSON and supports chaining', () => {
    const text = new TextDisplayBuilder()
      .setContent('# Welcome to LS Studio\nYour #1 Source for Minecraft Plugins & Bots!')
      .setSpoiler(false);

    const json = text.toJSON();
    assert.strictEqual(json.type, 10);
    assert.strictEqual(json.content, '# Welcome to LS Studio\nYour #1 Source for Minecraft Plugins & Bots!');
    assert.strictEqual(json.spoiler, false);
  });

  test('TextDisplayBuilder handles spoilers and empty content', () => {
    const text = new TextDisplayBuilder({ content: 'Top Secret' }).setSpoiler(true);
    assert.deepStrictEqual(text.toJSON(), {
      type: 10,
      content: 'Top Secret',
      spoiler: true,
    });
  });

  test('TextDisplayBuilder.from() creates clone or converts raw object', () => {
    const original = { type: 10, content: 'Hello World', spoiler: true };
    const builder = TextDisplayBuilder.from(original);
    assert.strictEqual(builder instanceof TextDisplayBuilder, true);
    assert.deepStrictEqual(builder.toJSON(), original);
  });

  // ----------------------------------------------------------------------------
  // 4. SEPARATOR BUILDER (Type 14)
  // ----------------------------------------------------------------------------
  console.log('\n\x1b[36m[Group 4: SeparatorBuilder]\x1b[0m');

  test('SeparatorBuilder defaults and chaining', () => {
    const sep = new SeparatorBuilder()
      .setDivider(true)
      .setSpacing(SeparatorSpacingSize.Small);

    assert.deepStrictEqual(sep.toJSON(), {
      type: 14,
      divider: true,
      spacing: 1,
    });
  });

  test('SeparatorBuilder accepts string spacing "small" / "large"', () => {
    const sep1 = new SeparatorBuilder().setSpacing('small');
    assert.strictEqual(sep1.toJSON().spacing, 1);

    const sep2 = new SeparatorBuilder().setSpacing('Large');
    assert.strictEqual(sep2.toJSON().spacing, 2);

    assert.throws(() => new SeparatorBuilder().setSpacing('medium'), TypeError);
    assert.throws(() => new SeparatorBuilder().setSpacing(3), RangeError);
  });

  // ----------------------------------------------------------------------------
  // 5. THUMBNAIL BUILDER (Type 11)
  // ----------------------------------------------------------------------------
  console.log('\n\x1b[36m[Group 5: ThumbnailBuilder]\x1b[0m');

  test('ThumbnailBuilder generates correct JSON format', () => {
    const thumb = new ThumbnailBuilder()
      .setURL('https://ls-studio.vn/logo.png')
      .setDescription('LS Studio Official Logo')
      .setSpoiler(false);

    assert.deepStrictEqual(thumb.toJSON(), {
      type: 11,
      media: { url: 'https://ls-studio.vn/logo.png' },
      description: 'LS Studio Official Logo',
      spoiler: false,
    });
  });

  test('ThumbnailBuilder supports proxy URL and spoiler', () => {
    const thumb = new ThumbnailBuilder()
      .setUrl('https://ls-studio.vn/secret.png')
      .setProxyUrl('https://media.discordapp.net/attachments/secret.png')
      .setSpoiler(true);

    assert.deepStrictEqual(thumb.toJSON(), {
      type: 11,
      media: {
        url: 'https://ls-studio.vn/secret.png',
        proxy_url: 'https://media.discordapp.net/attachments/secret.png',
      },
      spoiler: true,
    });
  });

  // ----------------------------------------------------------------------------
  // 6. MEDIA GALLERY BUILDER (Type 12)
  // ----------------------------------------------------------------------------
  console.log('\n\x1b[36m[Group 6: MediaGalleryBuilder & MediaGalleryItemBuilder]\x1b[0m');

  test('MediaGalleryItemBuilder serializes media item correctly', () => {
    const item = new MediaGalleryItemBuilder()
      .setURL('https://ls-studio.vn/banner.jpg')
      .setDescription('LS AntiCheat Showcase')
      .setSpoiler(false);

    assert.deepStrictEqual(item.toJSON(), {
      media: { url: 'https://ls-studio.vn/banner.jpg' },
      description: 'LS AntiCheat Showcase',
      spoiler: false,
    });
  });

  test('MediaGalleryBuilder handles multiple items and helper methods', () => {
    const gallery = new MediaGalleryBuilder()
      .addImage('https://ls-studio.vn/img1.png', 'Image 1', false)
      .addImage('https://ls-studio.vn/img2.png', 'Image 2', true);

    const json = gallery.toJSON();
    assert.strictEqual(json.type, 12);
    assert.strictEqual(json.items.length, 2);
    assert.deepStrictEqual(json.items[0], {
      media: { url: 'https://ls-studio.vn/img1.png' },
      description: 'Image 1',
      spoiler: false,
    });
    assert.deepStrictEqual(json.items[1], {
      media: { url: 'https://ls-studio.vn/img2.png' },
      description: 'Image 2',
      spoiler: true,
    });
  });

  test('MediaGalleryBuilder.addImages() supports array of URL strings', () => {
    const gallery = new MediaGalleryBuilder().addImages([
      'https://ls-studio.vn/shot1.png',
      'https://ls-studio.vn/shot2.png',
    ]);

    const json = gallery.toJSON();
    assert.strictEqual(json.items.length, 2);
    assert.strictEqual(json.items[0].media.url, 'https://ls-studio.vn/shot1.png');
    assert.strictEqual(json.items[1].media.url, 'https://ls-studio.vn/shot2.png');
  });

  // ----------------------------------------------------------------------------
  // 7. FILE BUILDER (Type 13)
  // ----------------------------------------------------------------------------
  console.log('\n\x1b[36m[Group 7: FileBuilder]\x1b[0m');

  test('FileBuilder handles attachment:// syntax and setAttachment helper', () => {
    const file1 = new FileBuilder().setAttachment('ls_anticheat_config.yml').setSpoiler(false);
    assert.deepStrictEqual(file1.toJSON(), {
      type: 13,
      file: { url: 'attachment://ls_anticheat_config.yml' },
      spoiler: false,
    });

    const file2 = new FileBuilder().setURL('attachment://transcript.html').setSpoiler(true);
    assert.deepStrictEqual(file2.toJSON(), {
      type: 13,
      file: { url: 'attachment://transcript.html' },
      spoiler: true,
    });
  });

  // ----------------------------------------------------------------------------
  // 8. BUTTON & SELECT MENU BUILDERS
  // ----------------------------------------------------------------------------
  console.log('\n\x1b[36m[Group 8: Button & Select Menu Builders]\x1b[0m');

  test('ButtonBuilder sets styles, customId, emoji, and labels', () => {
    const btn = new ButtonBuilder()
      .setStyle(ButtonStyle.Success)
      .setCustomId('buy_ls_anticheat')
      .setLabel('Mua Ngay - 99.000 VNĐ')
      .setEmoji('🛒');

    assert.deepStrictEqual(btn.toJSON(), {
      type: 2,
      style: 3,
      custom_id: 'buy_ls_anticheat',
      label: 'Mua Ngay - 99.000 VNĐ',
      emoji: { name: '🛒', id: null },
    });
  });

  test('ButtonBuilder supports Link style with URL', () => {
    const linkBtn = new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setURL('https://ls-studio.vn')
      .setLabel('Trang Chủ LS Studio');

    assert.deepStrictEqual(linkBtn.toJSON(), {
      type: 2,
      style: 5,
      url: 'https://ls-studio.vn',
      label: 'Trang Chủ LS Studio',
    });
  });

  test('StringSelectMenuBuilder sets placeholder, options, and limits', () => {
    const select = new StringSelectMenuBuilder()
      .setCustomId('select_product')
      .setPlaceholder('Chọn sản phẩm muốn mua...')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('LS AntiCheat V2')
          .setValue('pkg_anticheat')
          .setDescription('Bảo vệ máy chủ tối ưu')
          .setEmoji('🛡️')
          .setDefault(true),
        {
          label: 'Google AI Gemini Pro',
          value: 'pkg_gemini_pro',
          description: 'Tích hợp AI Sakayori',
          emoji: '🤖',
        }
      );

    const json = select.toJSON();
    assert.strictEqual(json.type, 3);
    assert.strictEqual(json.custom_id, 'select_product');
    assert.strictEqual(json.placeholder, 'Chọn sản phẩm muốn mua...');
    assert.strictEqual(json.min_values, 1);
    assert.strictEqual(json.max_values, 1);
    assert.strictEqual(json.options.length, 2);
    assert.strictEqual(json.options[0].default, true);
    assert.strictEqual(json.options[0].emoji.name, '🛡️');
    assert.strictEqual(json.options[1].value, 'pkg_gemini_pro');
  });

  // ----------------------------------------------------------------------------
  // 9. SECTION BUILDER (Type 9)
  // ----------------------------------------------------------------------------
  console.log('\n\x1b[36m[Group 9: SectionBuilder]\x1b[0m');

  test('SectionBuilder with TextDisplays and Button accessory', () => {
    const section = new SectionBuilder()
      .addTextDisplays(
        new TextDisplayBuilder().setContent('**LS AntiCheat - Bản Quyền**'),
        'Giá: 99.000 VNĐ / vĩnh viễn'
      )
      .setButtonAccessory(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Primary)
          .setCustomId('order_anticheat')
          .setLabel('Đặt Hàng')
      );

    const json = section.toJSON();
    assert.strictEqual(json.type, 9);
    assert.strictEqual(json.components.length, 2);
    assert.strictEqual(json.components[0].type, 10);
    assert.strictEqual(json.components[0].content, '**LS AntiCheat - Bản Quyền**');
    assert.strictEqual(json.components[1].type, 10);
    assert.strictEqual(json.components[1].content, 'Giá: 99.000 VNĐ / vĩnh viễn');
    assert.strictEqual(json.accessory.type, 2);
    assert.strictEqual(json.accessory.custom_id, 'order_anticheat');
  });

  test('SectionBuilder with Thumbnail accessory', () => {
    const section = new SectionBuilder()
      .addTextDisplayComponents('### Thông tin máy chủ LS Studio')
      .setThumbnailAccessory('https://ls-studio.vn/icon.png');

    const json = section.toJSON();
    assert.strictEqual(json.type, 9);
    assert.strictEqual(json.accessory.type, 11);
    assert.strictEqual(json.accessory.media.url, 'https://ls-studio.vn/icon.png');
  });

  // ----------------------------------------------------------------------------
  // 10. ACTION ROW BUILDER (Type 1)
  // ----------------------------------------------------------------------------
  console.log('\n\x1b[36m[Group 10: ActionRowBuilder]\x1b[0m');

  test('ActionRowBuilder groups interactive components', () => {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('btn_yes').setLabel('Đồng ý').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('btn_no').setLabel('Từ chối').setStyle(ButtonStyle.Danger)
    );

    const json = row.toJSON();
    assert.strictEqual(json.type, 1);
    assert.strictEqual(json.components.length, 2);
    assert.strictEqual(json.components[0].type, 2);
    assert.strictEqual(json.components[1].type, 2);
  });

  // ----------------------------------------------------------------------------
  // 11. CONTAINER BUILDER (Type 17) & FULL STRUCTURE TEST
  // ----------------------------------------------------------------------------
  console.log('\n\x1b[36m[Group 11: ContainerBuilder & Full Message Structure]\x1b[0m');

  test('ContainerBuilder holds sections, separators, media gallery, action rows', () => {
    const container = new ContainerBuilder()
      .setAccentColor('#5865F2') // Blurple
      .setSpoiler(false)
      .addComponents(
        // Header Section with thumbnail accessory
        new SectionBuilder()
          .addTextDisplays(
            '# 💎 LS STUDIO - DỊCH VỤ DISCORD & MINECRAFT',
            'Chuyên cung cấp bot custom, plugin anti-cheat và giải pháp server.'
          )
          .setThumbnailAccessory(
            new ThumbnailBuilder()
              .setURL('https://ls-studio.vn/badge.png')
              .setDescription('LS Studio Badge')
          ),

        // Visual Separator
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Large),

        // Product Showcase Section with Button
        new SectionBuilder()
          .addTextDisplays(
            '### 🛡️ LS AntiCheat V2\nChặn 100% Fly, Speed, KillAura, Wallhit, Packet Exploit.'
          )
          .setButtonAccessory(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Primary)
              .setCustomId('btn_order_ac')
              .setLabel('Mua 99k')
              .setEmoji('⚡')
          ),

        // Separator
        new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small),

        // Media Gallery
        new MediaGalleryBuilder().addImage('https://ls-studio.vn/ac_demo.png', 'Demo Screenshot'),

        // Interactive Action Row
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('view_terms').setLabel('Điều khoản').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setStyle(ButtonStyle.Link).setURL('https://ls-studio.vn').setLabel('Website')
        )
      );

    const json = container.toJSON();
    assert.strictEqual(json.type, 17);
    assert.strictEqual(json.accent_color, 0x5865f2);
    assert.strictEqual(json.spoiler, false);
    assert.strictEqual(json.components.length, 6);

    assert.strictEqual(json.components[0].type, 9);  // Section
    assert.strictEqual(json.components[1].type, 14); // Separator
    assert.strictEqual(json.components[2].type, 9);  // Section
    assert.strictEqual(json.components[3].type, 14); // Separator
    assert.strictEqual(json.components[4].type, 12); // MediaGallery
    assert.strictEqual(json.components[5].type, 1);  // ActionRow
  });

  test('ContainerBuilder accent color presets and conversions', () => {
    const c1 = new ContainerBuilder().setAccentColor('Gold');
    assert.strictEqual(c1.toJSON().accent_color, 0xf1c40f);

    const c2 = new ContainerBuilder().setAccentColor([255, 0, 0]);
    assert.strictEqual(c2.toJSON().accent_color, 0xff0000);

    const c3 = new ContainerBuilder({ accentColor: 0x57f287 });
    assert.strictEqual(c3.toJSON().accent_color, 0x57f287);
  });

  // ----------------------------------------------------------------------------
  // 12. DESERIALIZATION (fromJSON & .from())
  // ----------------------------------------------------------------------------
  console.log('\n\x1b[36m[Group 12: Deserialization & fromJSON()]\x1b[0m');

  test('fromJSON recreates builder instances faithfully', () => {
    const rawContainer = {
      type: 17,
      accent_color: 0x5865f2,
      spoiler: false,
      components: [
        {
          type: 9,
          components: [{ type: 10, content: 'Section Text' }],
          accessory: { type: 2, style: 1, custom_id: 'btn1', label: 'Click' },
        },
        {
          type: 14,
          divider: true,
          spacing: 1,
        },
        {
          type: 12,
          items: [{ media: { url: 'https://ls-studio.vn/pic.png' } }],
        },
        {
          type: 13,
          file: { url: 'attachment://log.txt' },
        },
      ],
    };

    const reconstructed = fromJSON(rawContainer);
    assert.strictEqual(reconstructed instanceof ContainerBuilder, true);
    assert.strictEqual(reconstructed.components[0] instanceof SectionBuilder, true);
    assert.strictEqual(reconstructed.components[1] instanceof SeparatorBuilder, true);
    assert.strictEqual(reconstructed.components[2] instanceof MediaGalleryBuilder, true);
    assert.strictEqual(reconstructed.components[3] instanceof FileBuilder, true);

    // Round-trip verification
    assert.deepStrictEqual(reconstructed.toJSON(), rawContainer);
  });

  // ----------------------------------------------------------------------------
  // 13. CREATE COMPONENT PAYLOAD HELPER
  // ----------------------------------------------------------------------------
  console.log('\n\x1b[36m[Group 13: createComponentPayload() Helper]\x1b[0m');

  test('createComponentPayload attaches MessageFlags.IsComponentsV2 (32768) automatically', () => {
    const container = new ContainerBuilder()
      .setAccentColor('Blurple')
      .addComponents(new TextDisplayBuilder().setContent('Hello Components V2!'));

    const payload = createComponentPayload({
      components: [container],
    });

    assert.strictEqual(payload.flags, MessageFlags.IsComponentsV2);
    assert.strictEqual(payload.components.length, 1);
    assert.strictEqual(payload.components[0].type, 17);
    assert.strictEqual(payload.components[0].components[0].type, 10);
  });

  test('createComponentPayload combines existing flags (e.g. Ephemeral | IsComponentsV2)', () => {
    const container = new ContainerBuilder().addComponents(new TextDisplayBuilder().setContent('Secret info'));

    const payload = createComponentPayload({
      flags: MessageFlags.Ephemeral,
      components: [container],
    });

    // Ephemeral (64) | IsComponentsV2 (32768) = 32832
    assert.strictEqual(payload.flags, 32832);
    assert.strictEqual(Boolean(payload.flags & MessageFlags.Ephemeral), true);
    assert.strictEqual(Boolean(payload.flags & MessageFlags.IsComponentsV2), true);
  });

  // ----------------------------------------------------------------------------
  // 14. DUAL-MODE PAYLOAD GENERATION & FALLBACK CONVERSION
  // ----------------------------------------------------------------------------
  console.log('\n\x1b[36m[Group 14: Dual-Mode Payload & Fallback Conversion]\x1b[0m');

  test('createDualModePayload: V2 Mode generates ContainerBuilder with IsComponentsV2 flag', () => {
    const payload = createDualModePayload({
      preferV2: true,
      title: 'LS AntiCheat Pro',
      description: 'Hệ thống bảo vệ máy chủ Minecraft',
      color: '#00E676',
      fields: [
        { name: 'Tính Năng', value: 'Auto-ban, Silent check' },
        { name: 'Giá Bán', value: '99.000 VNĐ' }
      ],
      thumbnailUrl: 'https://ls-studio.vn/icon.png',
      imageUrl: 'https://ls-studio.vn/banner.png',
      footer: 'LS STUDIO • 2026',
      buttons: [
        new ButtonBuilder().setCustomId('btn_buy_v2').setLabel('Mua Ngay').setStyle(ButtonStyle.Success)
      ],
      selectMenu: new StringSelectMenuBuilder().setCustomId('pkg_select').addOptions({ label: 'Option 1', value: 'opt1' }),
      spoiler: false,
      flags: MessageFlags.Ephemeral
    });

    assert.strictEqual(Boolean(payload.flags & MessageFlags.IsComponentsV2), true);
    assert.strictEqual(Boolean(payload.flags & MessageFlags.Ephemeral), true);
    assert.strictEqual(payload.components.length, 1);
    assert.strictEqual(payload.components[0].type, ComponentType.Container);
    assert.strictEqual(payload.components[0].accentColor, 0x00e676);
    assert.strictEqual(isComponentsV2Payload(payload), true);
  });

  test('createDualModePayload: Legacy Fallback Mode generates Embed & ActionRows', () => {
    const payload = createDualModePayload({
      preferV2: false,
      title: 'LS AntiCheat Pro',
      description: 'Hệ thống bảo vệ máy chủ Minecraft',
      color: '#00E676',
      fields: [
        { name: 'Tính Năng', value: 'Auto-ban, Silent check' }
      ],
      thumbnailUrl: 'https://ls-studio.vn/icon.png',
      imageUrl: 'https://ls-studio.vn/banner.png',
      footer: 'LS STUDIO • 2026',
      buttons: [
        new ButtonBuilder().setCustomId('btn_buy_v1').setLabel('Mua Ngay').setStyle(ButtonStyle.Success)
      ]
    });

    assert.strictEqual(Array.isArray(payload.embeds), true);
    assert.strictEqual(payload.embeds[0].title, 'LS AntiCheat Pro');
    assert.strictEqual(payload.embeds[0].color, 0x00e676);
    assert.strictEqual(payload.components.length, 1);
    assert.strictEqual(payload.components[0].type, ComponentType.ActionRow);
    assert.strictEqual(Boolean((payload.flags || 0) & MessageFlags.IsComponentsV2), false);
    assert.strictEqual(isComponentsV2Payload(payload), false);
  });

  test('convertLegacyToComponentsV2: Losslessly transforms legacy Embed into V2 Container', () => {
    const legacy = {
      embeds: [{
        title: 'Bảng Giá Dịch Vụ',
        description: 'Chi tiết các gói dịch vụ AI & Plugin',
        color: 0x5865f2,
        fields: [{ name: 'Gói 1', value: '30.000 VNĐ' }],
        thumbnail: { url: 'https://ls-studio.vn/thumb.png' },
        image: { url: 'https://ls-studio.vn/showcase.png' },
        footer: { text: 'LS STUDIO Support' }
      }],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('btn_order').setLabel('Order').setStyle(ButtonStyle.Primary)
        )
      ],
      flags: MessageFlags.Ephemeral
    };

    const v2 = convertLegacyToComponentsV2(legacy);
    assert.strictEqual(Boolean(v2.flags & MessageFlags.IsComponentsV2), true);
    assert.strictEqual(Boolean(v2.flags & MessageFlags.Ephemeral), true);
    assert.strictEqual(v2.components.length, 1);
    assert.strictEqual(v2.components[0] instanceof ContainerBuilder, true);
    assert.strictEqual(v2.components[0].accentColor, 0x5865f2);
  });

  test('convertComponentsV2ToLegacy: Reversible degradation to Embeds and unsets IsComponentsV2 flag', () => {
    const v2 = createDualModePayload({
      preferV2: true,
      title: 'Thông Báo Cập Nhật',
      description: 'Phiên bản 2.5 đã chính thức ra mắt',
      color: '#ED4245',
      fields: [{ name: 'Changelog', value: 'Fixed bugs & improved UI' }],
      imageUrl: 'https://ls-studio.vn/banner.png',
      thumbnailUrl: 'https://ls-studio.vn/thumb.png',
      footer: 'LS STUDIO Dev Team',
      buttons: [
        new ButtonBuilder().setCustomId('btn_changelog').setLabel('Xem Chi Tiết').setStyle(ButtonStyle.Secondary)
      ],
      flags: MessageFlags.Ephemeral
    });

    const legacy = convertComponentsV2ToLegacy(v2);
    assert.strictEqual(Array.isArray(legacy.embeds), true);
    assert.strictEqual(legacy.embeds[0].color, 0xed4245);
    assert.strictEqual(legacy.embeds[0].title, 'Thông Báo Cập Nhật');
    assert.strictEqual(legacy.components.length, 1);
    assert.strictEqual(Boolean(legacy.flags & MessageFlags.IsComponentsV2), false);
    assert.strictEqual(Boolean(legacy.flags & MessageFlags.Ephemeral), true);
  });

  // ----------------------------------------------------------------------------
  // 15. INTERACTION EVENT HANDLING ON V2 ACCESSORIES & ACTION ROWS
  // ----------------------------------------------------------------------------
  console.log('\n\x1b[36m[Group 15: Interaction Event Handling on V2 Components]\x1b[0m');

  await testAsync('Interaction Simulation: Button accessory on SectionBuilder handles click event & routes reply', async () => {
    // 1. Dựng Section với Button accessory (custom_id: btn_accessory_buy)
    const section = new SectionBuilder()
      .addTextDisplays('**LS-AntiCheat**', 'Giá: 30.000 VNĐ')
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId('btn_accessory_buy_ls_anticheat')
          .setLabel('Mua Ngay')
          .setStyle(ButtonStyle.Success)
      );

    const container = new ContainerBuilder()
      .setAccentColor(0x00E676)
      .addComponents(section);

    const payload = createComponentPayload({ components: [container] });

    // 2. Tạo Mock Interaction cho Button Accessory
    let repliedPayload = null;
    const mockButtonInteraction = {
      id: 'int_v2_btn_001',
      type: 3, // Component interaction
      customId: section.accessory.customId,
      user: { id: 'user_test_999', tag: 'Tester#0001' },
      isButton: () => true,
      isStringSelectMenu: () => false,
      deferred: false,
      replied: false,
      reply: async (p) => {
        mockButtonInteraction.replied = true;
        repliedPayload = p;
        return p;
      },
      deferUpdate: async () => {
        mockButtonInteraction.deferred = true;
        return true;
      }
    };

    // 3. Xử lý Interaction Router
    assert.strictEqual(mockButtonInteraction.customId, 'btn_accessory_buy_ls_anticheat');
    assert.strictEqual(mockButtonInteraction.isButton(), true);

    const responsePayload = createDualModePayload({
      preferV2: true,
      title: 'Hóa Đơn Mua Hàng',
      description: `Đơn hàng cho <@${mockButtonInteraction.user.id}> đã sẵn sàng!`,
      color: '#00E676',
      flags: MessageFlags.Ephemeral
    });

    await mockButtonInteraction.reply(responsePayload);

    assert.strictEqual(mockButtonInteraction.replied, true);
    assert.strictEqual(Boolean(repliedPayload.flags & MessageFlags.IsComponentsV2), true);
    assert.strictEqual(Boolean(repliedPayload.flags & MessageFlags.Ephemeral), true);
    assert.strictEqual(repliedPayload.components[0].type, ComponentType.Container);
  });

  await testAsync('Interaction Simulation: ActionRow StringSelectMenu inside Container updates message with V2 payload', async () => {
    // 1. Dựng Container chứa ActionRow với Select Menu
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_v2_package')
      .setPlaceholder('Chọn gói...')
      .addOptions([
        { label: 'LS AntiCheat', value: 'ls_anticheat' },
        { label: 'AI Gemini Pro', value: 'ai_gemini_pro' }
      ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);
    const container = new ContainerBuilder().addComponents(row);

    // 2. Tạo Mock Interaction cho Select Menu
    let updatePayload = null;
    const mockSelectInteraction = {
      id: 'int_v2_select_002',
      customId: 'select_v2_package',
      values: ['ls_anticheat'],
      user: { id: 'user_test_888', tag: 'Buyer#0002' },
      isButton: () => false,
      isStringSelectMenu: () => true,
      deferred: false,
      replied: false,
      update: async (p) => {
        mockSelectInteraction.replied = true;
        updatePayload = p;
        return p;
      }
    };

    // 3. Xử lý Select Menu router
    assert.strictEqual(mockSelectInteraction.isStringSelectMenu(), true);
    assert.strictEqual(mockSelectInteraction.values[0], 'ls_anticheat');

    const updatedV2 = createDualModePayload({
      preferV2: true,
      title: 'Đã Chọn: LS-AntiCheat',
      description: 'Số tiền: 30.000 VNĐ. Bấm xác nhận để thanh toán.',
      color: 0x5865F2,
      buttons: [
        new ButtonBuilder().setCustomId('btn_v2_confirm').setLabel('Xác Nhận').setStyle(ButtonStyle.Success)
      ]
    });

    await mockSelectInteraction.update(updatedV2);

    assert.strictEqual(mockSelectInteraction.replied, true);
    assert.strictEqual(Boolean(updatePayload.flags & MessageFlags.IsComponentsV2), true);
    assert.strictEqual(updatePayload.components[0].type, ComponentType.Container);
    assert.strictEqual(updatePayload.components[0].components[0].type, ComponentType.TextDisplay);
  });

  // ----------------------------------------------------------------------------
  // TEST SUMMARY REPORT
  // ----------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`📊 TEST RESULTS: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllTests().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
