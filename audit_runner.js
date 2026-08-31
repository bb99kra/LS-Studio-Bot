const fs = require('fs');
const path = require('path');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ComponentType
} = require('discord.js');

const files = fs.readdirSync('.').filter(f => f.endsWith('.js') && f !== 'node_modules' && f !== 'audit_runner.js');

console.log(`Auditing ${files.length} JavaScript files...\n`);

const results = [];

files.forEach(fileName => {
  const content = fs.readFileSync(fileName, 'utf8');
  const fileIssues = [];

  // 1. Check Button labels
  const labelMatches = [...content.matchAll(/\.setLabel\(\s*(['"`])([\s\S]*?)\1\s*\)/g)];
  for (const match of labelMatches) {
    const text = match[2];
    if (text.length > 80) {
      fileIssues.push({
        type: 'BUTTON_LABEL_TOO_LONG',
        detail: `Length ${text.length} > 80: "${text}"`
      });
    }
  }

  // 2. Check Button customIds
  const customIdMatches = [...content.matchAll(/\.setCustomId\(\s*(['"`])([\s\S]*?)\1\s*\)/g)];
  for (const match of customIdMatches) {
    const id = match[2];
    if (id.length > 100) {
      fileIssues.push({
        type: 'CUSTOM_ID_TOO_LONG',
        detail: `Length ${id.length} > 100: "${id}"`
      });
    }
  }

  // 3. Check Option descriptions
  const descMatches = [...content.matchAll(/\.setDescription\(\s*(['"`])([\s\S]*?)\1\s*\)/g)];
  for (const match of descMatches) {
    // Only check if it's in a select menu context or StringSelectMenuOptionBuilder
    const idx = match.index;
    const surrounding = content.substring(Math.max(0, idx - 150), Math.min(content.length, idx + 150));
    if (surrounding.includes('StringSelectMenuOptionBuilder') || surrounding.includes('SelectMenuOption') || surrounding.includes('addOptions')) {
      const desc = match[2];
      if (desc.length > 100) {
        fileIssues.push({
          type: 'SELECT_OPTION_DESC_TOO_LONG',
          detail: `Length ${desc.length} > 100: "${desc}"`
        });
      }
    }
  }

  // 4. Check Option labels
  const optLabelMatches = [...content.matchAll(/StringSelectMenuOptionBuilder[\s\S]*?\.setLabel\(\s*(['"`])([\s\S]*?)\1\s*\)/g)];
  for (const match of optLabelMatches) {
    const optLabel = match[2];
    if (optLabel.length > 100) {
      fileIssues.push({
        type: 'SELECT_OPTION_LABEL_TOO_LONG',
        detail: `Length ${optLabel.length} > 100: "${optLabel}"`
      });
    }
  }

  // 5. Check Option values
  const optValueMatches = [...content.matchAll(/StringSelectMenuOptionBuilder[\s\S]*?\.setValue\(\s*(['"`])([\s\S]*?)\1\s*\)/g)];
  for (const match of optValueMatches) {
    const optValue = match[2];
    if (optValue.length > 100) {
      fileIssues.push({
        type: 'SELECT_OPTION_VALUE_TOO_LONG',
        detail: `Length ${optValue.length} > 100: "${optValue}"`
      });
    }
  }

  // 6. Check ActionRowBuilder component count & rules
  // Find all addComponents blocks
  const rowMatches = [...content.matchAll(/new\s+ActionRowBuilder\(\s*\)\s*\.addComponents\(([\s\S]*?)\)(?:\s*;|\s*,|\s*\))/g)];
  for (const rMatch of rowMatches) {
    const inner = rMatch[1];
    // Count new ButtonBuilder or new StringSelectMenuBuilder or builder expressions
    const buttonCount = (inner.match(/new\s+ButtonBuilder/g) || []).length;
    const selectCount = (inner.match(/new\s+StringSelectMenuBuilder|buildPackageSelectMenu/g) || []).length;

    if (buttonCount > 5) {
      fileIssues.push({
        type: 'ACTION_ROW_MAX_BUTTONS_EXCEEDED',
        detail: `Row has ${buttonCount} buttons (> 5)`
      });
    }
    if (selectCount > 1) {
      fileIssues.push({
        type: 'ACTION_ROW_MAX_SELECTS_EXCEEDED',
        detail: `Row has ${selectCount} select menus (> 1)`
      });
    }
    if (selectCount > 0 && buttonCount > 0) {
      fileIssues.push({
        type: 'ACTION_ROW_MIXED_SELECT_AND_BUTTON',
        detail: `Row has ${selectCount} select menu(s) and ${buttonCount} button(s). Select menus must be in their own row.`
      });
    }
  }

  // 7. Check components array length in send/reply/update calls
  const compArrayMatches = [...content.matchAll(/components:\s*\[([\s\S]*?)\]/g)];
  for (const cMatch of compArrayMatches) {
    const inner = cMatch[1].trim();
    if (!inner) continue;
    // split by comma considering nested parenthesis
    let depth = 0;
    let items = 0;
    for (let i = 0; i < inner.length; i++) {
      const char = inner[i];
      if (char === '(' || char === '[' || char === '{') depth++;
      else if (char === ')' || char === ']' || char === '}') depth--;
      else if (char === ',' && depth === 0) items++;
    }
    if (inner.length > 0) items++; // last item

    if (items > 5) {
      fileIssues.push({
        type: 'COMPONENTS_MAX_ROWS_EXCEEDED',
        detail: `Message has ${items} ActionRows (> 5)`
      });
    }
  }

  // 8. Inspect every Button definition
  const buttonDeclarations = [...content.matchAll(/new\s+ButtonBuilder\(\s*\)([\s\S]*?)(?=(?:,\s*new\s+ButtonBuilder|\)\s*,|\)\s*;|\)\s*\]|\)\s*\.addComponents))/g)];
  for (const bDecl of buttonDeclarations) {
    const chain = bDecl[1];
    const hasCustomId = chain.includes('.setCustomId(');
    const hasUrl = chain.includes('.setURL(');
    const isLinkStyle = chain.includes('ButtonStyle.Link') || chain.includes('style: 5') || chain.includes('style: ButtonStyle.Link');
    const isPrimary = chain.includes('ButtonStyle.Primary');
    const isSecondary = chain.includes('ButtonStyle.Secondary');
    const isSuccess = chain.includes('ButtonStyle.Success');
    const isDanger = chain.includes('ButtonStyle.Danger');
    const hasAnyStyle = isLinkStyle || isPrimary || isSecondary || isSuccess || isDanger || chain.includes('.setStyle(');

    if (isLinkStyle && hasCustomId) {
      fileIssues.push({
        type: 'LINK_BUTTON_HAS_CUSTOM_ID',
        detail: `Link button cannot have custom_id: ${chain.trim()}`
      });
    }
    if (isLinkStyle && !hasUrl) {
      fileIssues.push({
        type: 'LINK_BUTTON_MISSING_URL',
        detail: `Link button missing setURL: ${chain.trim()}`
      });
    }
    if (!isLinkStyle && hasUrl) {
      fileIssues.push({
        type: 'NON_LINK_BUTTON_HAS_URL',
        detail: `Non-link button cannot have url: ${chain.trim()}`
      });
    }
    if (!isLinkStyle && !hasCustomId && hasAnyStyle) {
      fileIssues.push({
        type: 'NON_LINK_BUTTON_MISSING_CUSTOM_ID',
        detail: `Non-link button missing custom_id: ${chain.trim()}`
      });
    }
  }

  if (fileIssues.length > 0) {
    results.push({ fileName, issues: fileIssues });
  }
});

console.log('=== AUDIT RESULTS ===');
if (results.length === 0) {
  console.log('✅ All files passed Message Component audit cleanly! No violations found.');
} else {
  console.log(`❌ Found violations in ${results.length} files:`);
  results.forEach(r => {
    console.log(`\nFile: ${r.fileName}`);
    r.issues.forEach(i => {
      console.log(`  [${i.type}] ${i.detail}`);
    });
  });
}
