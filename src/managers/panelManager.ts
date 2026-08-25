import {
  Client, Interaction, ModalBuilder, TextInputBuilder, TextInputStyle,
  ActionRowBuilder, StringSelectMenuBuilder, ButtonInteraction,
  ModalSubmitInteraction, StringSelectMenuInteraction,
  EmbedBuilder, ColorResolvable, ThreadChannel, ButtonBuilder, ButtonStyle,
  GuildMember, TextChannel, RoleSelectMenuBuilder, RoleSelectMenuInteraction,
  ComponentType, Message, AttachmentBuilder,
  UserSelectMenuBuilder, UserSelectMenuInteraction, VoiceChannel, PermissionFlagsBits, ChannelType,
} from 'discord.js';
import { VerfahrenService } from '../services/verfahrenService';
import { hasJustizPermission, hasAdminPermission } from '../utils/permissions';
import { createErrorEmbed, createSuccessEmbed, createInfoEmbed, createWarningEmbed } from '../utils/embeds';
import { config } from '../config/config';
import { getDatabase } from '../database/database';
import { generateJustizaktePDF } from '../services/pdfService';
import { KATEGORIEN, ROLLEN_KEYS, buildPanelEmbed as buildRollenPanelEmbed, buildPanelButtons as buildRollenPanelButtons } from '../commands/rollenpanel';
import { ALLE_KATEGORIEN } from '../commands/rollenmenu';
import { handleAdminSelect, handleAdminModal } from '../commands/admin';

export class PanelManager {
  private client: Client;
  private verfahrenService: VerfahrenService;

  constructor(client: Client) {
    this.client = client;
    this.verfahrenService = new VerfahrenService(client);
  }

  async handleInteraction(interaction: Interaction): Promise<void> {
    try {
      if (interaction.isButton()) {
        await this.handleButton(interaction);
      } else if (interaction.isModalSubmit()) {
        await this.handleModal(interaction);
      } else if (interaction.isStringSelectMenu()) {
        await this.handleSelect(interaction);
      } else if (interaction.isRoleSelectMenu()) {
        await this.handleRoleSelect(interaction);
      } else if (interaction.isUserSelectMenu()) {
        await this.handleUserSelect(interaction);
      }
    } catch (err) {
      console.error('PanelManager Fehler:', err);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BUTTONS
  // ═══════════════════════════════════════════════════════════════════════════
  private async handleButton(interaction: ButtonInteraction): Promise<void> {
    const member = interaction.member as GuildMember;
    const id = interaction.customId;

    // ── TempVoice Interface ──
    if (id.startsWith('tempvoice_')) {
      await this.handleTempVoiceButton(interaction, member);
      return;
    }

    // ── Neues Verfahren Panel-Button ──
    // ── Verfahren mehrstufig — Weiter-Buttons ──────────────────────────────
    if (id === 'verfahren_weiter_2') {
      // Nach Select 1+2 → zeige Modal 2 (Tat & Sachverhalt)
      await interaction.showModal(this.buildVerfahrenModal2());
      return;
    }

    if (id === 'verfahren_weiter_3') {
      // Nach Modal 2 → zeige Select 3 (Beteiligte)
      const sel = this.buildVerfahrenSelect3(interaction.guildId!);
      await interaction.reply({ embeds: sel.embeds, components: sel.components as never, ephemeral: true });
      return;
    }

    if (id === 'verfahren_weiter_beteiligte') {
      // Nach Select 3 → Modal 3 (Geschädigter, Zeugen etc.)
      await interaction.showModal(this.buildVerfahrenModal3());
      return;
    }

    if (id === 'verfahren_erstellen_direkt') {
      await interaction.deferUpdate();
      await this.erstelleVerfahrenAusDraft(interaction as unknown as ButtonInteraction);
      return;
    }

    if (id === 'verfahren_abbrechen') {
      const db = getDatabase();
      db.prepare('DELETE FROM verfahren_draft WHERE guild_id = ? AND user_id = ?')
        .run(interaction.guildId!, interaction.user.id);
      await interaction.reply({ embeds: [createInfoEmbed('Abgebrochen', 'Der Verfahrens-Entwurf wurde gelöscht.')], ephemeral: true });
      return;
    }

    if (id === 'neues_verfahren') {
      await this.showVerfahrenModal(interaction);
      return;
    }

    // ── Verfahren-Aktionen (nur im Verfahrens-Thread) ──
    if (id === 'verfahren_bearbeiten') {
      if (!hasJustizPermission(member)) {
        await interaction.reply({ embeds: [createErrorEmbed('Keine Berechtigung', 'Du benötigst eine Justiz-Rolle.')], ephemeral: true });
        return;
      }
      const v = this.verfahrenService.getVerfahrenByThreadId(interaction.channelId);
      if (!v) { await interaction.reply({ embeds: [createErrorEmbed('Nicht gefunden', 'Verfahren nicht gefunden.')], ephemeral: true }); return; }
      if (v.gesperrt) { await interaction.reply({ embeds: [createErrorEmbed('Gesperrt', 'Dieses Verfahren ist gesperrt.')], ephemeral: true }); return; }
      await this.showBearbeitenModal(interaction, v.id, v.aktenzeichen, v);
      return;
    }

    if (id === 'verfahren_notiz') {
      if (!hasJustizPermission(member)) {
        await interaction.reply({ embeds: [createErrorEmbed('Keine Berechtigung', 'Du benötigst eine Justiz-Rolle.')], ephemeral: true });
        return;
      }
      const v = this.verfahrenService.getVerfahrenByThreadId(interaction.channelId);
      if (!v) { await interaction.reply({ embeds: [createErrorEmbed('Nicht gefunden', 'Verfahren nicht gefunden.')], ephemeral: true }); return; }
      if (v.gesperrt) { await interaction.reply({ embeds: [createErrorEmbed('Gesperrt', 'Dieses Verfahren ist gesperrt.')], ephemeral: true }); return; }
      await this.showNotizModal(interaction, v.id);
      return;
    }

    if (id === 'verfahren_status') {
      if (!hasJustizPermission(member)) {
        await interaction.reply({ embeds: [createErrorEmbed('Keine Berechtigung', 'Du benötigst eine Justiz-Rolle.')], ephemeral: true });
        return;
      }
      await this.showStatusSelect(interaction);
      return;
    }

    if (id === 'verfahren_abschliessen') {
      if (!hasJustizPermission(member)) {
        await interaction.reply({ embeds: [createErrorEmbed('Keine Berechtigung', 'Du benötigst eine Justiz-Rolle.')], ephemeral: true });
        return;
      }
      // Verfahren prüfen
      const v = this.verfahrenService.getVerfahrenByThreadId(interaction.channelId);
      if (!v) {
        await interaction.reply({ embeds: [createErrorEmbed('Nicht gefunden', 'Verfahren nicht gefunden.')], ephemeral: true });
        return;
      }
      if (v.status === 'abgeschlossen') {
        await interaction.reply({ embeds: [createErrorEmbed('Bereits abgeschlossen', 'Dieses Verfahren ist bereits abgeschlossen.')], ephemeral: true });
        return;
      }
      // Modal mit Urteil + Strafe öffnen
      const modal = new ModalBuilder()
        .setCustomId(`modal_abschliessen_${v.aktenzeichen}`)
        .setTitle('⚖️ Verfahren abschließen');

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('urteil')
            .setLabel('Urteil / Entscheidung (optional)')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(1000)
            .setPlaceholder('z.B. Schuldig — 3 Jahre Haft / Freispruch / Eingestellt...')
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('strafe')
            .setLabel('Strafe / Maßnahme (optional)')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(500)
            .setPlaceholder('z.B. 5.000 € Geldstrafe, Fahrverbot 6 Monate...')
        ),
      );

      await interaction.showModal(modal);
      return;
    }

    // Legacy-Button: verfahren_abschliessen_ja → jetzt auch Modal öffnen
    if (id === 'verfahren_abschliessen_ja') {
      if (!hasJustizPermission(member)) {
        await interaction.reply({ embeds: [createErrorEmbed('Keine Berechtigung', 'Du benötigst eine Justiz-Rolle.')], ephemeral: true });
        return;
      }
      const v = this.verfahrenService.getVerfahrenByThreadId(interaction.channelId);
      if (!v) {
        await interaction.reply({ embeds: [createErrorEmbed('Nicht gefunden', 'Verfahren nicht gefunden.')], ephemeral: true });
        return;
      }
      const modal = new ModalBuilder()
        .setCustomId(`modal_abschliessen_${v.aktenzeichen}`)
        .setTitle('⚖️ Verfahren abschließen');
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('urteil').setLabel('Urteil / Entscheidung (optional)')
            .setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(1000)
            .setPlaceholder('z.B. Schuldig — 3 Jahre Haft / Freispruch...')
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('strafe').setLabel('Strafe / Maßnahme (optional)')
            .setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500)
            .setPlaceholder('z.B. 5.000 € Geldstrafe...')
        ),
      );
      await interaction.showModal(modal);
      return;
    }
    if (id === 'verfahren_abschliessen_nein') {
      await interaction.reply({ embeds: [createInfoEmbed('Abgebrochen', 'Das Verfahren wurde nicht abgeschlossen.')], ephemeral: true });
      return;
    }

    if (id === 'verfahren_sperren') {
      if (!hasJustizPermission(member)) {
        await interaction.reply({ embeds: [createErrorEmbed('Keine Berechtigung', 'Du benötigst eine Justiz-Rolle.')], ephemeral: true });
        return;
      }
      await interaction.deferReply({ ephemeral: true });
      const v = this.verfahrenService.getVerfahrenByThreadId(interaction.channelId);
      if (!v) { await interaction.editReply({ embeds: [createErrorEmbed('Nicht gefunden', 'Verfahren nicht gefunden.')] }); return; }
      await this.verfahrenService.setGesperrt(interaction.guildId!, v.aktenzeichen, true, interaction.user.id);
      await interaction.editReply({ embeds: [createSuccessEmbed('Gesperrt', `Verfahren **${v.aktenzeichen}** wurde gesperrt.`)] });
      return;
    }

    if (id === 'verfahren_entsperren') {
      if (!hasJustizPermission(member)) {
        await interaction.reply({ embeds: [createErrorEmbed('Keine Berechtigung', 'Du benötigst eine Justiz-Rolle.')], ephemeral: true });
        return;
      }
      await interaction.deferReply({ ephemeral: true });
      const v = this.verfahrenService.getVerfahrenByThreadId(interaction.channelId);
      if (!v) { await interaction.editReply({ embeds: [createErrorEmbed('Nicht gefunden', 'Verfahren nicht gefunden.')] }); return; }
      await this.verfahrenService.setGesperrt(interaction.guildId!, v.aktenzeichen, false, interaction.user.id);
      await interaction.editReply({ embeds: [createSuccessEmbed('Entsperrt', `Verfahren **${v.aktenzeichen}** wurde entsperrt.`)] });
      return;
    }

    // Embed-Editor Buttons
    if (id.startsWith('embed_')) {
      await this.handleEmbedButton(interaction, member);
      return;
    }

    // Rollenpanel-Buttons
    if (id.startsWith('rollenpanel_')) {
      await this.handleRollenPanelButton(interaction, member);
      return;
    }

    // Rollen-Zuweisung bestätigen
    if (id.startsWith('rollenpanel_save_')) {
      await this.handleRollenSave(interaction, member);
      return;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODALS ANZEIGEN
  // ═══════════════════════════════════════════════════════════════════════════
  // VERFAHREN — ERSTELLUNGS-FLOW (mehrstufig mit Dropdowns)
  // ═══════════════════════════════════════════════════════════════════════════

  private async showVerfahrenModal(interaction: ButtonInteraction): Promise<void> {
    const db = getDatabase();
    db.prepare('DELETE FROM verfahren_draft WHERE guild_id = ? AND user_id = ?')
      .run(interaction.guildId!, interaction.user.id);
    db.prepare(`INSERT INTO verfahren_draft (guild_id, user_id, channel_id) VALUES (?, ?, ?)
      ON CONFLICT(guild_id, user_id) DO UPDATE SET channel_id = excluded.channel_id`)
      .run(interaction.guildId!, interaction.user.id, interaction.channelId);
    await interaction.showModal(this.buildVerfahrenModal1());
  }

  /** Modal 1: Personendaten — alle eigenen Felder */
  private buildVerfahrenModal1(): ModalBuilder {
    return new ModalBuilder()
      .setCustomId('modal_verfahren_1')
      .setTitle('Neues Verfahren — 1/5: Personendaten')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('beschuldigter')
            .setLabel('Vor- und Nachname (Beschuldigter)')
            .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)
            .setPlaceholder('Max Mustermann')
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('roblox_name')
            .setLabel('Roblox-Name (In-Game)')
            .setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(100)
            .setPlaceholder('RobloxUsername')
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('roblox_id')
            .setLabel('Roblox-ID')
            .setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(50)
            .setPlaceholder('12345678')
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('geburtsdatum')
            .setLabel('Alter / Geburtsdatum (optional)')
            .setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(50)
            .setPlaceholder('01.01.2000 / 24 Jahre')
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('fraktion')
            .setLabel('Fraktion / Beruf im RP (optional)')
            .setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(80)
            .setPlaceholder('Polizei / Feuerwehr / Zivilist')
        ),
      );
  }

  /** Select 1: Verfahrensart + Gericht */
  private buildVerfahrenSelect1(): { embeds: EmbedBuilder[]; components: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] } {
    return {
      embeds: [new EmbedBuilder()
        .setColor(config.colors.justiz as ColorResolvable)
        .setTitle('⚖️ Verfahren — 2/5: Verfahrensart & Gericht')
        .setDescription('Wähle Verfahrensart und zuständiges Gericht.')
      ],
      components: [
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder().setCustomId('vf_select_verfahrensart')
            .setPlaceholder('📋 Verfahrensart auswählen...')
            .addOptions([
              { label: 'Strafverfahren',        value: 'Strafverfahren',        description: 'Strafrechtliche Verfolgung',   emoji: '⚖️' },
              { label: 'Ermittlungsverfahren',  value: 'Ermittlungsverfahren',  description: 'Laufende Ermittlung',         emoji: '🔍' },
              { label: 'Gerichtsverfahren',     value: 'Gerichtsverfahren',     description: 'Verfahren vor Gericht',       emoji: '🏛️' },
              { label: 'Zivilverfahren',        value: 'Zivilverfahren',        description: 'Zivilrechtliche Klage',       emoji: '📄' },
              { label: 'Ordnungswidrigkeiten',  value: 'Ordnungswidrigkeiten',  description: 'Verstöße ohne Strafcharakter',emoji: '📋' },
              { label: 'Festnahme-Protokoll',   value: 'Festnahme',             description: 'Festnahme-Protokoll',        emoji: '🔒' },
              { label: 'Sonstiges',             value: 'Sonstiges',             description: 'Sonstiger Vorgang',           emoji: '📌' },
            ])
        ),
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder().setCustomId('vf_select_gericht')
            .setPlaceholder('🏛️ Zuständiges Gericht auswählen...')
            .addOptions([
              { label: 'Amtsgericht',         value: 'Amtsgericht',         emoji: '🏛️' },
              { label: 'Landgericht',         value: 'Landgericht',         emoji: '🏛️' },
              { label: 'Oberlandesgericht',   value: 'Oberlandesgericht',   emoji: '🏛️' },
              { label: 'Bundesgericht',       value: 'Bundesgericht',       emoji: '🏛️' },
              { label: 'Polizeiwache',        value: 'Polizeiwache',        emoji: '🚓' },
              { label: '— Nicht zugewiesen —',value: 'keine',               emoji: '➖' },
            ])
        ),
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId('verfahren_abbrechen').setLabel('Abbrechen').setStyle(ButtonStyle.Secondary),
        ),
      ],
    };
  }

  /** Select 2: Vorwurf / Delikt */
  private buildVerfahrenSelect2(): { embeds: EmbedBuilder[]; components: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] } {
    return {
      embeds: [new EmbedBuilder()
        .setColor(config.colors.justiz as ColorResolvable)
        .setTitle('⚖️ Verfahren — 3/5: Vorwurf / Delikt')
        .setDescription('Wähle den Vorwurf / das Delikt. Mehrfachauswahl möglich (max. 5).')
      ],
      components: [
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder().setCustomId('vf_select_vorwurf')
            .setPlaceholder('🔍 Vorwurf / Delikt auswählen...')
            .setMinValues(1).setMaxValues(5)
            .addOptions([
              { label: 'Körperverletzung',           value: 'Körperverletzung',           emoji: '👊' },
              { label: 'Schwere Körperverletzung',   value: 'Schwere Körperverletzung',   emoji: '🩸' },
              { label: 'Diebstahl',                  value: 'Diebstahl',                  emoji: '💰' },
              { label: 'Raub / Überfall',            value: 'Raub / Überfall',            emoji: '🔫' },
              { label: 'Sachbeschädigung',           value: 'Sachbeschädigung',           emoji: '🪟' },
              { label: 'Betrug / Urkundenfälschung', value: 'Betrug / Urkundenfälschung', emoji: '📄' },
              { label: 'Waffenbesitz / -handel',     value: 'Waffenbesitz / -handel',     emoji: '🔫' },
              { label: 'Drogenbesitz / -handel',     value: 'Drogenbesitz / -handel',     emoji: '💊' },
              { label: 'Fahren ohne Führerschein',   value: 'Fahren ohne Führerschein',   emoji: '🚗' },
              { label: 'Verkehrsdelikt',             value: 'Verkehrsdelikt',             emoji: '🚦' },
              { label: 'Widerstand gegen Beamte',    value: 'Widerstand gegen Beamte',    emoji: '🚓' },
              { label: 'Hausfriedensbruch',          value: 'Hausfriedensbruch',          emoji: '🏠' },
              { label: 'Beleidigung / Nötigung',     value: 'Beleidigung / Nötigung',     emoji: '🗣️' },
              { label: 'Mord / Totschlag',           value: 'Mord / Totschlag',           emoji: '💀' },
              { label: 'Sonstiges',                  value: 'Sonstiges',                  emoji: '📌' },
            ])
        ),
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId('verfahren_abbrechen').setLabel('Abbrechen').setStyle(ButtonStyle.Secondary),
        ),
      ],
    };
  }

  /** Modal 2: Tatzeit, Tatort, Sachverhalt, Beweise */
  private buildVerfahrenModal2(): ModalBuilder {
    return new ModalBuilder()
      .setCustomId('modal_verfahren_2')
      .setTitle('Neues Verfahren — 4/5: Tat & Sachverhalt')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('tatzeit')
            .setLabel('Tatzeit')
            .setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(80)
            .setPlaceholder('z.B. 14:30 Uhr, 25.08.2026 gegen 14 Uhr')
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('tatort')
            .setLabel('Tatort')
            .setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(100)
            .setPlaceholder('z.B. Rathaus, Hauptstraße 5, Polizeiwache')
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('sachverhalt')
            .setLabel('Sachverhalt / Chronologie')
            .setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000)
            .setPlaceholder('Sachliche Beschreibung des Vorfalls...')
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('beweise')
            .setLabel('Beweise / Beschreibung (optional)')
            .setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500)
            .setPlaceholder('Video, Screenshot, Zeugenaussage...')
        ),
      );
  }

  /** Select 3: Beteiligte — Richter, SA, Anwalt, Ermittler je einzeln */
  private buildVerfahrenSelect3(guildId: string): { embeds: EmbedBuilder[]; components: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] } {
    const db = getDatabase();
    const rollenConfig = db.prepare('SELECT role_key, role_id FROM role_config WHERE guild_id = ?')
      .all(guildId) as Array<{ role_key: string; role_id: string }>;
    const roleMap = new Map(rollenConfig.map(r => [r.role_key, r.role_id]));

    const KEY_LABELS: Record<string, string> = {
      justizLeitung: 'Justiz-Leitung', richter: 'Richter',
      staatsanwalt: 'Staatsanwalt', anwalt: 'Anwalt',
      justizAnwaerter: 'Justizanwärter', polizeiLeitung: 'Polizei-Leitung',
      polizei: 'Polizei', polizeiAnwaerter: 'Polizeianwärter',
    };

    const justizKeys   = ['justizLeitung', 'richter', 'staatsanwalt', 'anwalt', 'justizAnwaerter'];
    const ermittlerKeys = ['polizeiLeitung', 'polizei', 'polizeiAnwaerter', 'justizLeitung', 'richter', 'staatsanwalt'];

    const makeOpts = (keys: string[]) => {
      const base = [{ label: '— Nicht zugewiesen —', value: 'keine', emoji: '➖' as string }];
      const found = keys.filter(k => roleMap.has(k))
        .map(k => ({ label: KEY_LABELS[k] ?? k, value: k, emoji: '⚖️' as string }));
      return found.length ? [...base, ...found] : [...base, { label: 'Keine Rollen konfiguriert', value: 'none', emoji: '⚠️' as string }];
    };

    return {
      embeds: [new EmbedBuilder()
        .setColor(config.colors.justiz as ColorResolvable)
        .setTitle('⚖️ Verfahren — 5/5: Beteiligte')
        .setDescription('Weise Richter, Staatsanwalt, Anwalt und Ermittler zu.\n**"— Nicht zugewiesen —"** wählen zum Überspringen.')
      ],
      components: [
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder().setCustomId('vf_select_richter')
            .setPlaceholder('⚖️ Richter auswählen...')
            .addOptions(makeOpts(justizKeys))
        ),
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder().setCustomId('vf_select_staatsanwalt')
            .setPlaceholder('⚖️ Staatsanwalt auswählen...')
            .addOptions(makeOpts(justizKeys))
        ),
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder().setCustomId('vf_select_anwalt')
            .setPlaceholder('🏛️ Anwalt / Verteidiger auswählen...')
            .addOptions(makeOpts(justizKeys))
        ),
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder().setCustomId('vf_select_ermittler')
            .setPlaceholder('🔍 Ermittler auswählen...')
            .addOptions(makeOpts(ermittlerKeys))
        ),
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId('verfahren_weiter_beteiligte').setLabel('Weiter — Beteiligte & Abschluss').setStyle(ButtonStyle.Primary).setEmoji('👥'),
          new ButtonBuilder().setCustomId('verfahren_erstellen_direkt').setLabel('Jetzt erstellen').setStyle(ButtonStyle.Success).setEmoji('✅'),
          new ButtonBuilder().setCustomId('verfahren_abbrechen').setLabel('Abbrechen').setStyle(ButtonStyle.Secondary),
        ),
      ],
    };
  }

  /** Modal 3: Geschädigter, Zeugen, Weitere, Zusatzinfo */
  private buildVerfahrenModal3(): ModalBuilder {
    return new ModalBuilder()
      .setCustomId('modal_verfahren_3')
      .setTitle('Neues Verfahren — Beteiligte')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('geschaedigter')
            .setLabel('Geschädigter / Gegenpartei')
            .setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(100)
            .setPlaceholder('Vor- und Nachname / Roblox-Name')
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('zeugen')
            .setLabel('Zeuge(n)')
            .setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(300)
            .setPlaceholder('Zeuge 1: Name / ID\nZeuge 2: Name / ID')
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('ermittler')
            .setLabel('Ermittler (Person / Einheit)')
            .setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(150)
            .setPlaceholder('Kriminalinspektor M. Müller / KI-3')
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('weitere_beteiligte')
            .setLabel('Weitere Beteiligte (optional)')
            .setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(200)
            .setPlaceholder('z.B. weitere Tatverdächtige, Sachverständige...')
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('zusatzinfo')
            .setLabel('Zusätzliche Informationen (optional)')
            .setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500)
            .setPlaceholder('Besonderheiten, Hinweise, Verweise auf andere Akten...')
        ),
      );
  }

  private async showBearbeitenModal(
    interaction: ButtonInteraction,
    verfahrenId: number,
    aktenzeichen: string,
    v: { beschuldigter: string; roblox_name: string; roblox_id: string; geschaedigter: string;
         zeugen: string; ermittler: string; richter: string; staatsanwalt: string;
         anwalt: string; vorwurf: string; tatzeit: string; tatort: string; sachverhalt: string; }
  ): Promise<void> {
    // Discord erlaubt max 5 Felder pro Modal — wir zeigen die wichtigsten
    const modal = new ModalBuilder()
      .setCustomId(`modal_bearbeiten_${verfahrenId}`)
      .setTitle(`Bearbeiten | ${aktenzeichen}`);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('beschuldigter')
          .setLabel('Beschuldigter / Antragsteller')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setValue(v.beschuldigter || '')
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('vorwurf')
          .setLabel('Vorwurf / Antrag')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setValue(v.vorwurf || '')
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('sachverhalt')
          .setLabel('Sachverhalt')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setValue(v.sachverhalt || '')
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('beteiligte_justiz')
          .setLabel('Richter | Staatsanwalt | Anwalt')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setValue([v.richter, v.staatsanwalt, v.anwalt].filter(Boolean).join(' | '))
          .setPlaceholder('Richter | Staatsanwalt | Anwalt')
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('beteiligte_sonstige')
          .setLabel('Geschädigter | Zeugen | Ermittler')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setValue([v.geschaedigter, v.zeugen, v.ermittler].filter(Boolean).join('\n'))
          .setPlaceholder('Geschädigter: ...\nZeugen: ...\nErmittler: ...')
      ),
    );

    await interaction.showModal(modal);
  }

  private async showNotizModal(interaction: ButtonInteraction, verfahrenId: number): Promise<void> {
    const modal = new ModalBuilder()
      .setCustomId(`modal_notiz_${verfahrenId}`)
      .setTitle('Notiz hinzufügen');

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('notiz')
          .setLabel('Notiztext')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000)
          .setPlaceholder('Gib deine Notiz ein...')
      ),
    );

    await interaction.showModal(modal);
  }

  private async showStatusSelect(interaction: ButtonInteraction): Promise<void> {
    const row = new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('select_status')
          .setPlaceholder('Status auswählen...')
          .addOptions(
            { label: '🟡 Offen', value: 'offen', description: 'Verfahren ist offen' },
            { label: '🟠 Ermittlung', value: 'ermittlung', description: 'Ermittlungsphase' },
            { label: '🔴 Strafverfahren', value: 'strafverfahren', description: 'Laufendes Strafverfahren' },
            { label: '⚖️ Gerichtsverfahren', value: 'gerichtsverfahren', description: 'Verfahren vor Gericht' },
            { label: '🟢 Abgeschlossen', value: 'abgeschlossen', description: 'Verfahren abschließen + in Akten übertragen' },
          )
      );

    await interaction.reply({
      content: '**⚖️ Status auswählen:**\n> Hinweis: „Abgeschlossen" löst den vollständigen Abschluss-Workflow aus.',
      components: [row],
      ephemeral: true
    });
  }

  private async showAbschliessenConfirm(interaction: ButtonInteraction): Promise<void> {
    const v = this.verfahrenService.getVerfahrenByThreadId(interaction.channelId);
    if (!v) {
      await interaction.reply({ embeds: [createErrorEmbed('Nicht gefunden', 'Verfahren nicht gefunden.')], ephemeral: true });
      return;
    }
    if (v.status === 'abgeschlossen') {
      await interaction.reply({ embeds: [createErrorEmbed('Bereits abgeschlossen', 'Dieses Verfahren ist bereits abgeschlossen.')], ephemeral: true });
      return;
    }

    // Direkt Urteil-Modal öffnen statt Bestätigungs-Dialog
    const modal = new ModalBuilder()
      .setCustomId(`modal_abschliessen_${v.aktenzeichen}`)
      .setTitle('⚖️ Verfahren abschließen');

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('urteil')
          .setLabel('Urteil / Entscheidung (optional)')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setMaxLength(1000)
          .setPlaceholder('z.B. Schuldig — 3 Jahre Haft / Freispruch / Eingestellt...')
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('strafe')
          .setLabel('Strafe / Maßnahme (optional)')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setMaxLength(500)
          .setPlaceholder('z.B. 5.000 € Geldstrafe, Fahrverbot 6 Monate...')
      ),
    );

    await interaction.showModal(modal);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODALS VERARBEITEN
  // ═══════════════════════════════════════════════════════════════════════════
  private async handleModal(interaction: ModalSubmitInteraction): Promise<void> {
    const id = interaction.customId;

    if (id.startsWith('modal_tempvoice_')) {
      await this.handleTempVoiceModal(interaction);
    } else if (id.startsWith('modal_admin_')) {
      await handleAdminModal(interaction);
    } else if (id.startsWith('modal_abschliessen_')) {
      await this.handleAbschliessenModal(interaction);
    } else if (id === 'modal_verfahren_1' || id === 'modal_neues_verfahren') {
      await this.handleVerfahrenModal1(interaction);
    } else if (id === 'modal_verfahren_2') {
      await this.handleVerfahrenModal2(interaction);
    } else if (id === 'modal_verfahren_3') {
      await this.handleVerfahrenModal3(interaction);
    } else if (id.startsWith('modal_notiz_')) {
      await this.handleNotizModal(interaction);
    } else if (id.startsWith('modal_bearbeiten_')) {
      await this.handleBearbeitenModal(interaction);
    } else if (id.startsWith('modal_embed_senden_')) {
      await this.handleEmbedSendenModal(interaction);
    }
  }

  // ── Modal 1 verarbeiten ──────────────────────────────────────────────────────
  private async handleNeuesVerfahrenModal(interaction: ModalSubmitInteraction): Promise<void> {
    // Dieser Handler bleibt als Fallback für alte Interaktionen — leitet zu modal_verfahren_1 weiter
    await this.handleVerfahrenModal1(interaction);
  }

  private async handleVerfahrenModal1(interaction: ModalSubmitInteraction): Promise<void> {
    try {
      const beschuldigter = interaction.fields.getTextInputValue('beschuldigter').trim();
      const robloxName    = this.safeField(interaction, 'roblox_name');
      const robloxId      = this.safeField(interaction, 'roblox_id');
      const geburtsdatum  = this.safeField(interaction, 'geburtsdatum');
      const fraktion      = this.safeField(interaction, 'fraktion');

      const db = getDatabase();
      db.prepare(`INSERT INTO verfahren_draft
          (guild_id, user_id, channel_id, beschuldigter, roblox_name, roblox_id, geburtsdatum, fraktion)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(guild_id, user_id) DO UPDATE SET
          beschuldigter = excluded.beschuldigter,
          roblox_name   = excluded.roblox_name,
          roblox_id     = excluded.roblox_id,
          geburtsdatum  = excluded.geburtsdatum,
          fraktion      = excluded.fraktion`)
        .run(interaction.guildId!, interaction.user.id, interaction.channelId,
          beschuldigter, robloxName || null, robloxId || null,
          geburtsdatum || null, fraktion || null);

      // Modal 1 kommt vom öffentlichen Panel-Button → immer neue ephemeral Nachricht
      const sel = this.buildVerfahrenSelect1();
      await interaction.reply({
        embeds: sel.embeds,
        components: sel.components as never,
        ephemeral: true,
      });
    } catch (err) {
      console.error('Modal1 Fehler:', err);
      if (!interaction.replied && !interaction.deferred)
        await interaction.reply({ embeds: [createErrorEmbed('Fehler', String(err))], ephemeral: true });
    }
  }

  // ── Modal 2 verarbeiten ──────────────────────────────────────────────────────
  private async handleVerfahrenModal2(interaction: ModalSubmitInteraction): Promise<void> {
    try {
      const tatzeit     = this.safeField(interaction, 'tatzeit');
      const tatort      = this.safeField(interaction, 'tatort');
      const sachverhalt = interaction.fields.getTextInputValue('sachverhalt').trim();
      const beweise     = this.safeField(interaction, 'beweise');

      const db = getDatabase();
      db.prepare(`UPDATE verfahren_draft
        SET tatzeit = ?, tatort = ?, sachverhalt = ?, beweise = ?
        WHERE guild_id = ? AND user_id = ?`)
        .run(tatzeit || null, tatort || null, sachverhalt, beweise || null,
          interaction.guildId!, interaction.user.id);

      // Zeige Select 3 (Beteiligte) — update() ersetzt die vorherige Nachricht
      const sel = this.buildVerfahrenSelect3(interaction.guildId!);
      if (interaction.isFromMessage()) {
        await interaction.update({ embeds: sel.embeds, components: sel.components as never });
      } else {
        await interaction.reply({ embeds: sel.embeds, components: sel.components as never, ephemeral: true });
      }
    } catch (err) {
      console.error('Modal2 Fehler:', err);
      if (!interaction.replied && !interaction.deferred)
        await interaction.reply({ embeds: [createErrorEmbed('Fehler', String(err))], ephemeral: true });
    }
  }

  // ── Modal 3 verarbeiten + Verfahren erstellen ────────────────────────────────
  private async handleVerfahrenModal3(interaction: ModalSubmitInteraction): Promise<void> {
    try {
      const geschaedigter      = this.safeField(interaction, 'geschaedigter');
      const zeugen             = this.safeField(interaction, 'zeugen');
      const ermittler          = this.safeField(interaction, 'ermittler');
      const weitere_beteiligte = this.safeField(interaction, 'weitere_beteiligte');
      const zusatzinfo         = this.safeField(interaction, 'zusatzinfo');

      const db = getDatabase();
      db.prepare(`
        UPDATE verfahren_draft
        SET geschaedigter = ?, zeugen = ?, ermittler = ?, weitere_beteiligte = ?, zusatzinfo = ?
        WHERE guild_id = ? AND user_id = ?
      `).run(
        geschaedigter || null, zeugen || null, ermittler || null,
        weitere_beteiligte || null, zusatzinfo || null,
        interaction.guildId!, interaction.user.id
      );

      await this.erstelleVerfahrenAusDraft(interaction);
    } catch (err) {
      console.error('handleVerfahrenModal3 Fehler:', err);
      try {
        const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ embeds: [createErrorEmbed('Fehler', msg)], ephemeral: true });
        } else {
          await interaction.editReply({ embeds: [createErrorEmbed('Fehler', msg)] });
        }
      } catch { /* ignore */ }
    }
  }

  // ── Draft → Verfahren erstellen ──────────────────────────────────────────────
  private async erstelleVerfahrenAusDraft(interaction: ModalSubmitInteraction | ButtonInteraction): Promise<void> {
    const db = getDatabase();
    const draft = db.prepare('SELECT * FROM verfahren_draft WHERE guild_id = ? AND user_id = ?')
      .get(interaction.guildId!, interaction.user.id) as DraftRow | undefined;

    const errReply = async (msg: string) => {
      const embed = createErrorEmbed('Fehler', msg);
      try {
        if (interaction.isModalSubmit()) {
          if (!interaction.replied && !interaction.deferred) await interaction.reply({ embeds: [embed], ephemeral: true });
          else await interaction.editReply({ embeds: [embed], components: [] });
        } else {
          await interaction.editReply({ embeds: [embed], components: [] });
        }
      } catch { /* ignore */ }
    };

    if (!draft) {
      await errReply('Kein Verfahrens-Entwurf gefunden. Bitte starte neu mit dem ➕ Button.');
      return;
    }

    try {
      const aktenzeichen = await this.verfahrenService.createVerfahren({
        guildId:             interaction.guildId!,
        verfahrensart:       draft.verfahrensart       || 'Strafverfahren',
        beschuldigter:       draft.beschuldigter       || '',
        robloxName:          draft.roblox_name         || '',
        robloxId:            draft.roblox_id           || '',
        fraktion:            draft.fraktion            || '',
        zustaendigesGericht: draft.zustaendiges_gericht || '',
        geschaedigter:       draft.geschaedigter       || '',
        zeugen:              draft.zeugen              || '',
        ermittler:           draft.ermittler           || '',
        richter:             draft.richter             || '',
        staatsanwalt:        draft.staatsanwalt        || '',
        anwalt:              draft.anwalt              || '',
        vorwurf:             draft.vorwurf             || '',
        tatzeit:             draft.tatzeit             || '',
        tatort:              draft.tatort              || '',
        sachverhalt:         draft.sachverhalt         || '',
        beweise:             draft.beweise             || '',
        weitereBeeteiligte:  draft.weitere_beteiligte  || '',
        zusatzinfo:          draft.zusatzinfo          || '',
        erstelltVon:         interaction.user.username,
      });

      // Draft löschen
      db.prepare('DELETE FROM verfahren_draft WHERE guild_id = ? AND user_id = ?')
        .run(interaction.guildId!, interaction.user.id);

      const successEmbed = createSuccessEmbed(
        '✅ Verfahren erstellt',
        `**Aktenzeichen:** ${aktenzeichen}\n**Beschuldigter:** ${draft.beschuldigter}\n**Verfahrensart:** ${draft.verfahrensart}\n\nDas Verfahren wurde im Forum-Kanal eröffnet.`
      );

      if (interaction.isModalSubmit()) {
        // Von einer ephemeral Nachricht (Button) → update ersetzt sie
        if (interaction.isFromMessage()) {
          await interaction.update({ embeds: [successEmbed], components: [] });
        } else if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ embeds: [successEmbed], components: [], ephemeral: true });
        } else {
          await interaction.editReply({ embeds: [successEmbed], components: [] });
        }
      } else {
        // Button-Interaction (verfahren_erstellen_direkt) → update
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ embeds: [successEmbed], components: [] });
        } else {
          await interaction.update({ embeds: [successEmbed], components: [] });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
      await errReply(msg);
    }
  }

  private async handleNotizModal(interaction: ModalSubmitInteraction): Promise<void> {
    const verfahrenId = parseInt(interaction.customId.replace('modal_notiz_', ''));
    if (isNaN(verfahrenId)) { await interaction.reply({ embeds: [createErrorEmbed('Fehler', 'Ungültige Verfahrens-ID.')], ephemeral: true }); return; }
    // deferReply sofort
    await interaction.deferReply({ ephemeral: true });
    const notiz = interaction.fields.getTextInputValue('notiz').trim();
    try {
      await this.verfahrenService.addNotiz(verfahrenId, notiz, interaction.user.id, interaction.user.username);
      await interaction.editReply({ embeds: [createSuccessEmbed('Notiz hinzugefügt', `Deine Notiz wurde gespeichert und im Verfahren angezeigt.`)] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
      await interaction.editReply({ embeds: [createErrorEmbed('Fehler', msg)] });
    }
  }

  private async handleBearbeitenModal(interaction: ModalSubmitInteraction): Promise<void> {
    const verfahrenId = parseInt(interaction.customId.replace('modal_bearbeiten_', ''));
    if (isNaN(verfahrenId)) { await interaction.reply({ embeds: [createErrorEmbed('Fehler', 'Ungültige Verfahrens-ID.')], ephemeral: true }); return; }
    // deferReply sofort
    await interaction.deferReply({ ephemeral: true });

    // Beteiligte-Felder parsen
    const justizStr = this.safeField(interaction, 'beteiligte_justiz');
    const [richter = '', staatsanwalt = '', anwalt = ''] = justizStr.split('|').map(s => s.trim());

    const sonstigeStr = this.safeField(interaction, 'beteiligte_sonstige');
    const sonstigeLines = sonstigeStr.split('\n');
    const geschaedigter = this.extractField(sonstigeLines, 'geschädigter') || sonstigeLines[0] || '';
    const zeugen = this.extractField(sonstigeLines, 'zeugen') || sonstigeLines[1] || '';
    const ermittler = this.extractField(sonstigeLines, 'ermittler') || sonstigeLines[2] || '';

    try {
      await this.verfahrenService.updateVerfahren(verfahrenId, {
        beschuldigter: this.safeField(interaction, 'beschuldigter'),
        vorwurf: this.safeField(interaction, 'vorwurf'),
        sachverhalt: this.safeField(interaction, 'sachverhalt'),
        richter, staatsanwalt, anwalt, geschaedigter, zeugen, ermittler,
      }, interaction.user.id);

      await interaction.editReply({ embeds: [createSuccessEmbed('Verfahren aktualisiert', 'Alle Änderungen wurden gespeichert und das Embed wurde aktualisiert.')] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
      await interaction.editReply({ embeds: [createErrorEmbed('Fehler', msg)] });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ABSCHLUSS-MODAL — PDF generieren + hochladen
  // ═══════════════════════════════════════════════════════════════════════════
  private async handleAbschliessenModal(interaction: ModalSubmitInteraction): Promise<void> {
    if (!hasJustizPermission(interaction.member as GuildMember)) {
      await interaction.reply({ embeds: [createErrorEmbed('Keine Berechtigung', 'Du benötigst eine Justiz-Rolle.')], ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const aktenzeichen = interaction.customId.replace('modal_abschliessen_', '');
    const urteil  = interaction.fields.getTextInputValue('urteil').trim()  || '';
    const strafe  = interaction.fields.getTextInputValue('strafe').trim()  || '';
    const guildId = interaction.guildId!;

    // Urteil + Strafe vor dem Abschließen in DB speichern
    const db = getDatabase();
    db.prepare("UPDATE verfahren SET urteil = ?, strafe = ? WHERE aktenzeichen = ? AND guild_id = ?")
      .run(urteil || null, strafe || null, aktenzeichen, guildId);

    // Verfahren abschließen (erstellt Akten-Thread, löscht Verfahrens-Thread)
    try {
      await this.verfahrenService.abschliessen(guildId, aktenzeichen, interaction.user.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
      await interaction.editReply({ embeds: [createErrorEmbed('Fehler beim Abschließen', msg)] });
      return;
    }

    // Verfahren nochmal aus DB laden (jetzt mit abgeschlossen_am + urteil/strafe)
    const verfahren = db.prepare('SELECT * FROM verfahren WHERE aktenzeichen = ? AND guild_id = ?')
      .get(aktenzeichen, guildId) as (import('../services/verfahrenService').VerfahrenRow & {
        urteil?: string; strafe?: string;
        abgeschlossen_am?: string; abgeschlossen_von?: string;
      }) | undefined;

    if (!verfahren) {
      await interaction.editReply({ embeds: [createSuccessEmbed('Verfahren abgeschlossen', `**${aktenzeichen}** wurde abgeschlossen.\n⚠️ PDF konnte nicht erstellt werden (Verfahren nicht mehr in DB).`)] });
      return;
    }

    // Notizen laden
    const notizen = this.verfahrenService.getNotizenFull(verfahren.id);

    // PDF generieren
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await generateJustizaktePDF(
        {
          ...verfahren,
          urteil:                urteil  || verfahren.urteil  || '',
          strafe:                strafe  || verfahren.strafe  || '',
          abgeschlossen_von_name: interaction.user.tag,
        },
        notizen
      );
    } catch (pdfErr) {
      console.error('PDF-Generierung fehlgeschlagen:', pdfErr);
      await interaction.editReply({
        embeds: [createSuccessEmbed(
          '✅ Verfahren abgeschlossen',
          `**${aktenzeichen}** wurde abgeschlossen.\n⚠️ PDF-Generierung fehlgeschlagen: ${pdfErr instanceof Error ? pdfErr.message : 'Unbekannt'}`
        )],
      });
      return;
    }

    // PDF in den Akten-Thread hochladen
    const settings = db.prepare('SELECT akten_channel_id FROM server_settings WHERE guild_id = ?')
      .get(guildId) as { akten_channel_id: string | null } | undefined;

    let pdfGesendet = false;
    if (settings?.akten_channel_id) {
      try {
        const { ChannelType } = await import('discord.js');
        const aktenChannel = await this.client.channels.fetch(settings.akten_channel_id);

        if (aktenChannel && aktenChannel.type === ChannelType.GuildForum) {
          // Akten-Thread suchen (wurde gerade von abschliessen() erstellt)
          const aktenRow = db.prepare('SELECT forum_post_id FROM akten WHERE aktenzeichen = ?').get(aktenzeichen) as { forum_post_id: string } | undefined;

          if (aktenRow?.forum_post_id) {
            const thread = await this.client.channels.fetch(aktenRow.forum_post_id) as ThreadChannel;
            if (thread) {
              const filename = `Justizakte_${aktenzeichen.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`;
              const attachment = new AttachmentBuilder(pdfBuffer, { name: filename, description: `Justizakte ${aktenzeichen}` });

              await thread.send({
                content: `📄 **Justizakte — ${aktenzeichen}**\nAutomatisch generiert beim Abschluss durch ${interaction.user}.`,
                files: [attachment],
              });
              pdfGesendet = true;
            }
          }
        }
      } catch (uploadErr) {
        console.error('PDF-Upload in Akten-Thread fehlgeschlagen:', uploadErr);
      }
    }

    // Erfolgsmeldung
    const desc = [
      `Verfahren **${aktenzeichen}** wurde abgeschlossen und in die Akten übertragen.`,
      urteil  ? `\n⚖️ **Urteil:** ${urteil}`   : '',
      strafe  ? `\n🔒 **Strafe:** ${strafe}`    : '',
      pdfGesendet ? '\n📄 **Justizakte** wurde als PDF in den Akten-Thread hochgeladen.' : '\n⚠️ PDF konnte nicht in den Thread hochgeladen werden.',
    ].join('');

    await interaction.editReply({ embeds: [createSuccessEmbed('✅ Verfahren abgeschlossen', desc)] });
  }

  private async handleEmbedModal(interaction: ModalSubmitInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });
    // Wird vom EmbedService verarbeitet — hier nur Bestätigung
    await interaction.editReply({ embeds: [createInfoEmbed('Embed', 'Embed-Erstellung über /embed erstellen.')] });
  }

  private async handleEmbedSendenModal(interaction: ModalSubmitInteraction): Promise<void> {
    const channelId = interaction.customId.replace('modal_embed_senden_', '');
    // deferReply SOFORT
    await interaction.deferReply({ ephemeral: true });

    try {
      const channel = await this.client.channels.fetch(channelId) as import('discord.js').TextChannel;
      if (!channel) {
        await interaction.editReply({ embeds: [createErrorEmbed('Fehler', 'Kanal nicht gefunden.')] });
        return;
      }

      const titel = this.safeField(interaction, 'titel');
      const beschreibung = this.safeField(interaction, 'beschreibung');
      const farbeRaw = this.safeField(interaction, 'farbe') || '#5865F2';
      const autor = this.safeField(interaction, 'autor');
      const fusszeile = this.safeField(interaction, 'fusszeile') || 'Deutscher RP Server';

      let farbe: number;
      try {
        farbe = parseInt(farbeRaw.replace('#', ''), 16);
        if (isNaN(farbe)) farbe = config.colors.server;
      } catch {
        farbe = config.colors.server;
      }

      const embed = new EmbedBuilder()
        .setColor(farbe as ColorResolvable)
        .setTitle(titel)
        .setDescription(beschreibung)
        .setFooter({ text: fusszeile })
        .setTimestamp();

      if (autor) embed.setAuthor({ name: autor });

      await channel.send({ embeds: [embed] });
      await interaction.editReply({ embeds: [createSuccessEmbed('Embed gesendet', `Das Embed wurde erfolgreich in <#${channelId}> gesendet.`)] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
      await interaction.editReply({ embeds: [createErrorEmbed('Fehler beim Senden', msg)] });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SELECT MENUS
  // ═══════════════════════════════════════════════════════════════════════════
  private async handleSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    const member = interaction.member as GuildMember;

    // ── Verfahren Select-Menüs ──
    if (interaction.customId.startsWith('vf_select_')) {
      await this.handleVerfahrenSelect(interaction);
      return;
    }

    // ── Admin-Menü ──
    if (interaction.customId === 'admin_menu_aktion') {
      await handleAdminSelect(interaction);
      return;
    }

    // ── Rollen-Menü (Selbst-Zuweisung) ──
    if (interaction.customId.startsWith('rollenmenu_')) {
      await this.handleRollenMenu(interaction, member);
      return;
    }

    // Rollen-Kategorie auswählen
    if (interaction.customId === 'rollenpanel_select_key') {
      await this.handleRollenKeySelect(interaction, member);
      return;
    }

    if (interaction.customId === 'select_status') {
      if (!hasJustizPermission(member)) {
        await interaction.reply({ embeds: [createErrorEmbed('Keine Berechtigung', 'Du benötigst eine Justiz-Rolle.')], ephemeral: true });
        return;
      }

      const status = interaction.values[0];

      // Wenn Abgeschlossen → direkt Urteil-Modal öffnen
      if (status === 'abgeschlossen') {
        const verfahren = this.verfahrenService.getVerfahrenByThreadId(interaction.channelId);
        if (!verfahren) {
          await interaction.reply({ embeds: [createErrorEmbed('Nicht gefunden', 'Verfahren nicht gefunden.')], ephemeral: true });
          return;
        }
        if (verfahren.status === 'abgeschlossen') {
          await interaction.reply({ embeds: [createErrorEmbed('Bereits abgeschlossen', 'Dieses Verfahren ist bereits abgeschlossen.')], ephemeral: true });
          return;
        }

        const modal = new ModalBuilder()
          .setCustomId(`modal_abschliessen_${verfahren.aktenzeichen}`)
          .setTitle('⚖️ Verfahren abschließen');

        modal.addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('urteil')
              .setLabel('Urteil / Entscheidung (optional)')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(false)
              .setMaxLength(1000)
              .setPlaceholder('z.B. Schuldig — 3 Jahre Haft / Freispruch / Eingestellt...')
          ),
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('strafe')
              .setLabel('Strafe / Maßnahme (optional)')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(false)
              .setMaxLength(500)
              .setPlaceholder('z.B. 5.000 € Geldstrafe, Fahrverbot 6 Monate...')
          ),
        );

        await interaction.showModal(modal);
        return;
      }

      // Alle anderen Status: deferUpdate SOFORT, dann DB
      await interaction.deferUpdate();
      const verfahren = this.verfahrenService.getVerfahrenByThreadId(interaction.channelId);
      if (!verfahren) {
        await interaction.followUp({ embeds: [createErrorEmbed('Nicht gefunden', 'Verfahren nicht gefunden.')], ephemeral: true });
        return;
      }
      await this.verfahrenService.updateStatus(interaction.guildId!, verfahren.aktenzeichen, status, interaction.user.id);
      await interaction.followUp({
        embeds: [createSuccessEmbed('Status aktualisiert', `Status von **${verfahren.aktenzeichen}** → **${status}**`)],
        ephemeral: true
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VERFAHREN SELECT-HANDLER
  // ═══════════════════════════════════════════════════════════════════════════

  private async handleVerfahrenSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    const db = getDatabase();
    const customId = interaction.customId;
    const guildId  = interaction.guildId!;
    const userId   = interaction.user.id;
    const val      = interaction.values[0] ?? '';
    const vals     = interaction.values; // für Mehrfachauswahl (Vorwurf)

    const KEY_LABELS: Record<string, string> = {
      justizLeitung: 'Justiz-Leitung', richter: 'Richter',
      staatsanwalt: 'Staatsanwalt', anwalt: 'Anwalt',
      justizAnwaerter: 'Justizanwärter', polizeiLeitung: 'Polizei-Leitung',
      polizei: 'Polizei', polizeiAnwaerter: 'Polizeianwärter',
    };

    // Verfahrensart
    if (customId === 'vf_select_verfahrensart') {
      db.prepare('UPDATE verfahren_draft SET verfahrensart = ? WHERE guild_id = ? AND user_id = ?')
        .run(val || null, guildId, userId);
      await interaction.deferUpdate();
      return;
    }

    // Zuständiges Gericht → danach Select 2 (Vorwurf) zeigen
    if (customId === 'vf_select_gericht') {
      const gerichtVal = (val === 'keine' || val === 'none') ? null : (val || null);
      db.prepare('UPDATE verfahren_draft SET zustaendiges_gericht = ? WHERE guild_id = ? AND user_id = ?')
        .run(gerichtVal, guildId, userId);

      const draft = db.prepare('SELECT verfahrensart FROM verfahren_draft WHERE guild_id = ? AND user_id = ?')
        .get(guildId, userId) as { verfahrensart: string | null } | undefined;

      if (!draft?.verfahrensart) {
        await interaction.reply({
          embeds: [createErrorEmbed('Verfahrensart fehlt', 'Bitte wähle zuerst eine Verfahrensart aus.')],
          ephemeral: true,
        });
        return;
      }

      const sel = this.buildVerfahrenSelect2();
      await interaction.update({ embeds: sel.embeds, components: sel.components as never });
      return;
    }

    // Vorwurf (Mehrfachauswahl) → danach Modal 2 (Tat & Sachverhalt)
    if (customId === 'vf_select_vorwurf') {
      const vorwurf = vals.join(', ');
      db.prepare('UPDATE verfahren_draft SET vorwurf = ? WHERE guild_id = ? AND user_id = ?')
        .run(vorwurf, guildId, userId);

      // Weiter zu Modal 2
      await interaction.update({
        embeds: [new EmbedBuilder()
          .setColor(config.colors.justiz as ColorResolvable)
          .setTitle('⚖️ Verfahren — Vorwurf gespeichert ✅')
          .setDescription(`**Vorwurf:** ${vorwurf}\n\nKlicke auf **Weiter** um Tatzeit, Tatort und Sachverhalt einzutragen.`)
        ],
        components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId('verfahren_weiter_2').setLabel('Weiter — Tat & Sachverhalt').setStyle(ButtonStyle.Primary).setEmoji('📝'),
          new ButtonBuilder().setCustomId('verfahren_abbrechen').setLabel('Abbrechen').setStyle(ButtonStyle.Secondary),
        ) as never],
      });
      return;
    }

    // Richter
    if (customId === 'vf_select_richter') {
      const label = (val && val !== 'none' && val !== 'keine') ? (KEY_LABELS[val] ?? val) : '';
      db.prepare('UPDATE verfahren_draft SET richter = ? WHERE guild_id = ? AND user_id = ?')
        .run(label || null, guildId, userId);
      await interaction.deferUpdate();
      return;
    }

    // Staatsanwalt
    if (customId === 'vf_select_staatsanwalt') {
      const label = (val && val !== 'none' && val !== 'keine') ? (KEY_LABELS[val] ?? val) : '';
      db.prepare('UPDATE verfahren_draft SET staatsanwalt = ? WHERE guild_id = ? AND user_id = ?')
        .run(label || null, guildId, userId);
      await interaction.deferUpdate();
      return;
    }

    // Anwalt
    if (customId === 'vf_select_anwalt') {
      const label = (val && val !== 'none' && val !== 'keine') ? (KEY_LABELS[val] ?? val) : '';
      db.prepare('UPDATE verfahren_draft SET anwalt = ? WHERE guild_id = ? AND user_id = ?')
        .run(label || null, guildId, userId);
      await interaction.deferUpdate();
      return;
    }

    // Ermittler
    if (customId === 'vf_select_ermittler') {
      const label = (val && val !== 'none' && val !== 'keine') ? (KEY_LABELS[val] ?? val) : '';
      db.prepare('UPDATE verfahren_draft SET ermittler = ? WHERE guild_id = ? AND user_id = ?')
        .run(label || null, guildId, userId);
      await interaction.deferUpdate();
      return;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ROLLEN-PANEL HANDLER
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Wird aufgerufen wenn jemand einen Kategorie-Button im Rollen-Panel drückt.
   * Zeigt für jede Rolle der Kategorie ein RoleSelectMenu.
   * Discord erlaubt max. 5 ActionRows → max. 5 Selects pro Nachricht.
   */
  private async handleRollenPanelButton(interaction: ButtonInteraction, member: GuildMember): Promise<void> {
    if (!hasAdminPermission(member)) {
      await interaction.reply({
        embeds: [createErrorEmbed('Keine Berechtigung', 'Du benötigst Administrator-Rechte.')],
        ephemeral: true,
      });
      return;
    }

    // Kategorie aus customId ermitteln: "rollenpanel_justiz" → "justiz"
    const kategorie = interaction.customId.replace('rollenpanel_', '');
    const kat = KATEGORIEN[kategorie];
    if (!kat) {
      await interaction.reply({ embeds: [createErrorEmbed('Fehler', `Unbekannte Kategorie: ${kategorie}`)], ephemeral: true });
      return;
    }

    const db = getDatabase();
    const konfig = db.prepare('SELECT role_key, role_id FROM role_config WHERE guild_id = ?')
      .all(interaction.guildId!) as unknown as Array<{ role_key: string; role_id: string }>;
    const roleMap = new Map(konfig.map(r => [r.role_key, r.role_id]));

    // Für jede Rolle ein RoleSelectMenu aufbauen (max. 5 Rows = 5 Rollen)
    const rows: ActionRowBuilder<RoleSelectMenuBuilder>[] = kat.rollen.slice(0, 5).map(rollenKey => {
      const rollenInfo = ROLLEN_KEYS.find(r => r.key === rollenKey)!;
      const aktuelleRolleId = roleMap.get(rollenKey);
      const label = aktuelleRolleId
        ? `${rollenInfo.emoji} ${rollenInfo.label} (aktuell gesetzt)`
        : `${rollenInfo.emoji} ${rollenInfo.label}`;

      return new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
        new RoleSelectMenuBuilder()
          .setCustomId(`rollenpanel_role_${kategorie}_${rollenKey}`)
          .setPlaceholder(label)
          .setMinValues(1)
          .setMaxValues(1)
      );
    });

    // Falls Kategorie mehr als 5 Rollen hat → zweite Seite nötig (Justiz hat 7)
    const embed = new EmbedBuilder()
      .setColor(kat.farbe as ColorResolvable)
      .setTitle(`${kat.emoji} ${kat.titel}`)
      .setDescription(
        kat.rollen.slice(0, 5).map(key => {
          const info = ROLLEN_KEYS.find(r => r.key === key)!;
          const aktuelleId = roleMap.get(key);
          return `${info.emoji} **${info.label}** → ${aktuelleId ? `<@&${aktuelleId}>` : '❌ Nicht gesetzt'}\n> ${info.beschreibung}`;
        }).join('\n\n')
      )
      .setFooter({ text: kat.rollen.length > 5 ? `Seite 1/2 • ${kat.rollen.length} Rollen insgesamt` : `${kat.rollen.length} Rollen in dieser Kategorie` });

    await interaction.reply({ embeds: [embed], components: rows, ephemeral: true });

    // Falls Justiz (7 Rollen) → zweite Seite direkt danach senden
    if (kat.rollen.length > 5) {
      const restRollen = kat.rollen.slice(5);
      const restRows: ActionRowBuilder<RoleSelectMenuBuilder>[] = restRollen.map(rollenKey => {
        const rollenInfo = ROLLEN_KEYS.find(r => r.key === rollenKey)!;
        const aktuelleRolleId = roleMap.get(rollenKey);
        const label = aktuelleRolleId
          ? `${rollenInfo.emoji} ${rollenInfo.label} (aktuell gesetzt)`
          : `${rollenInfo.emoji} ${rollenInfo.label}`;

        return new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
          new RoleSelectMenuBuilder()
            .setCustomId(`rollenpanel_role_${kategorie}_${rollenKey}`)
            .setPlaceholder(label)
            .setMinValues(1)
            .setMaxValues(1)
        );
      });

      const embed2 = new EmbedBuilder()
        .setColor(kat.farbe as ColorResolvable)
        .setTitle(`${kat.emoji} ${kat.titel} — Seite 2`)
        .setDescription(
          restRollen.map(key => {
            const info = ROLLEN_KEYS.find(r => r.key === key)!;
            const aktuelleId = roleMap.get(key);
            return `${info.emoji} **${info.label}** → ${aktuelleId ? `<@&${aktuelleId}>` : '❌ Nicht gesetzt'}\n> ${info.beschreibung}`;
          }).join('\n\n')
        )
        .setFooter({ text: 'Seite 2/2' });

      await interaction.followUp({ embeds: [embed2], components: restRows, ephemeral: true });
    }
  }

  /**
   * Wird aufgerufen wenn eine Rolle im RoleSelectMenu ausgewählt wurde.
   * Speichert die Zuweisung in der DB und aktualisiert das Panel-Embed.
   */
  private async handleRoleSelect(interaction: RoleSelectMenuInteraction): Promise<void> {
    const member = interaction.member as GuildMember;
    if (!hasAdminPermission(member)) {
      await interaction.reply({
        embeds: [createErrorEmbed('Keine Berechtigung', 'Du benötigst Administrator-Rechte.')],
        ephemeral: true,
      });
      return;
    }

    // customId: "rollenpanel_role_<kategorie>_<rollenKey>"
    if (!interaction.customId.startsWith('rollenpanel_role_')) return;

    const parts = interaction.customId.replace('rollenpanel_role_', '').split('_');
    // kategorie kann auch Unterstrich haben nicht — aber rollenKey auch. Wir nehmen letztes Segment als key
    // Format: rollenpanel_role_{kategorie}_{rollenKey}
    // Wir suchen den ersten Teil der einem gültigen KATEGORIEN-Key entspricht
    let kategorie = '';
    let rollenKey = '';
    const kategorieKeys = Object.keys(KATEGORIEN);
    for (const k of kategorieKeys) {
      if (interaction.customId.startsWith(`rollenpanel_role_${k}_`)) {
        kategorie = k;
        rollenKey = interaction.customId.replace(`rollenpanel_role_${k}_`, '');
        break;
      }
    }

    if (!rollenKey) {
      await interaction.reply({ embeds: [createErrorEmbed('Fehler', 'Ungültige Rollen-Auswahl.')], ephemeral: true });
      return;
    }

    const selectedRole = interaction.roles.first();
    if (!selectedRole) {
      await interaction.reply({ embeds: [createErrorEmbed('Fehler', 'Keine Rolle ausgewählt.')], ephemeral: true });
      return;
    }

    // UPSERT in role_config
    const db = getDatabase();
    db.prepare(`
      INSERT INTO role_config (guild_id, role_key, role_id)
      VALUES (?, ?, ?)
      ON CONFLICT(guild_id, role_key) DO UPDATE SET role_id = excluded.role_id
    `).run(interaction.guildId!, rollenKey, selectedRole.id);

    const rollenInfo = ROLLEN_KEYS.find(r => r.key === rollenKey);
    const label = rollenInfo ? rollenInfo.label : rollenKey;

    await interaction.reply({
      embeds: [createSuccessEmbed(
        '✅ Rolle gespeichert',
        `**${label}** wurde <@&${selectedRole.id}> zugewiesen.\n\nDas Panel wird beim nächsten Öffnen aktualisiert.`
      )],
      ephemeral: true,
    });

    // Versuche das Panel-Embed in der ursprünglichen Nachricht zu aktualisieren
    try {
      const channel = interaction.channel;
      if (channel && 'messages' in channel) {
        // Suche nach der Panel-Nachricht (hat Rollenpanel-Buttons)
        const messages = await (channel as TextChannel).messages.fetch({ limit: 20 });
        const panelMsg = messages.find(m => {
          if (m.author.id !== this.client.user?.id) return false;
          if (m.components.length === 0) return false;
          const row = m.components[0];
          if (row.type !== ComponentType.ActionRow) return false;
          return row.components.some(c => 'customId' in c && (c.customId as string)?.startsWith('rollenpanel_'));
        });
        if (panelMsg) {
          const { buildPanelEmbed: bpe, buildPanelButtons: bpb } = await import('../commands/rollenpanel');
          await panelMsg.edit({
            embeds: [bpe(interaction.guildId!)],
            components: bpb(),
          });
        }
      }
    } catch (updateErr) {
      // Panel-Update ist optional — kein Fehler werfen
      console.warn('Panel-Update nach Rollen-Speicherung fehlgeschlagen:', updateErr);
    }
  }

  /**
   * Rollen-Menü: Selbst-Zuweisung via StringSelectMenu.
   * Wählt der Nutzer eine Rolle → toggle (hinzufügen oder entfernen).
   */
  private async handleRollenMenu(interaction: StringSelectMenuInteraction, member: GuildMember): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const selectedKey = interaction.values[0];

    // Kategorie aus customId ermitteln: "rollenmenu_menu_justiz" → kat.id = "menu_justiz"
    const katId = interaction.customId.replace('rollenmenu_', '');
    const kat = ALLE_KATEGORIEN.find(k => k.id === katId);
    if (!kat) {
      await interaction.editReply({ embeds: [createErrorEmbed('Fehler', 'Unbekannte Kategorie.')] });
      return;
    }

    const rollenInfo = kat.rollen.find(r => r.key === selectedKey);
    if (!rollenInfo) {
      await interaction.editReply({ embeds: [createErrorEmbed('Fehler', 'Unbekannte Rolle.')] });
      return;
    }

    // Discord-Rollen-ID aus role_config holen
    const db = getDatabase();
    const row = db.prepare('SELECT role_id FROM role_config WHERE guild_id = ? AND role_key = ?')
      .get(interaction.guildId!, selectedKey) as { role_id: string } | undefined;

    if (!row?.role_id) {
      await interaction.editReply({
        embeds: [createErrorEmbed(
          'Rolle nicht konfiguriert',
          `Die Rolle **${rollenInfo.label}** wurde noch nicht mit einer Discord-Rolle verknüpft.\nBitte nutze \`/rollen-panel erstellen\` um Rollen zu konfigurieren.`
        )],
      });
      return;
    }

    const roleId = row.role_id;

    // Prüfen ob Mitglied die Rolle schon hat → Toggle
    const hatRolle = member.roles.cache.has(roleId);

    try {
      if (hatRolle) {
        await member.roles.remove(roleId, `Rollen-Menü: ${rollenInfo.label} entfernt`);
        await interaction.editReply({
          embeds: [createSuccessEmbed(
            'Rolle entfernt',
            `Die Rolle ${rollenInfo.emoji} **${rollenInfo.label}** wurde dir entfernt.`
          )],
        });
      } else {
        await member.roles.add(roleId, `Rollen-Menü: ${rollenInfo.label} zugewiesen`);
        await interaction.editReply({
          embeds: [createSuccessEmbed(
            'Rolle zugewiesen',
            `Die Rolle ${rollenInfo.emoji} **${rollenInfo.label}** wurde dir zugewiesen.`
          )],
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
      await interaction.editReply({
        embeds: [createErrorEmbed('Fehler beim Zuweisen', `Konnte die Rolle nicht ändern.\n\`${msg}\`\n\nStelle sicher, dass der Bot die Berechtigung hat, Rollen zu verwalten, und dass die Rolle unterhalb der Bot-Rolle liegt.`)],
      });
    }
  }

  /**
   * Legacy-Handler für String-Select bei Rollen-Key-Auswahl (nicht mehr aktiv, aber sicherheitshalber drin)
   */
  private async handleRollenKeySelect(interaction: StringSelectMenuInteraction, member: GuildMember): Promise<void> {
    if (!hasAdminPermission(member)) {
      await interaction.reply({ embeds: [createErrorEmbed('Keine Berechtigung', 'Du benötigst Administrator-Rechte.')], ephemeral: true });
      return;
    }
    await interaction.reply({ embeds: [createInfoEmbed('Hinweis', 'Bitte nutze das Rollen-Panel über `/rollen-panel erstellen`.')], ephemeral: true });
  }

  /**
   * Speichert alle Rollen einer Kategorie auf einmal (bulk-save Button)
   */
  private async handleRollenSave(interaction: ButtonInteraction, member: GuildMember): Promise<void> {
    if (!hasAdminPermission(member)) {
      await interaction.reply({ embeds: [createErrorEmbed('Keine Berechtigung', 'Du benötigst Administrator-Rechte.')], ephemeral: true });
      return;
    }
    // Dieser Button wird nicht mehr genutzt (war ein alter Ansatz), aber wir lassen ihn als No-Op stehen
    await interaction.reply({ embeds: [createSuccessEmbed('Gespeichert', 'Alle Rollen wurden gespeichert.')], ephemeral: true });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EMBED EDITOR BUTTONS
  // ═══════════════════════════════════════════════════════════════════════════
  private async handleEmbedButton(interaction: ButtonInteraction, member: GuildMember): Promise<void> {
    if (!hasAdminPermission(member) && !hasJustizPermission(member)) {
      await interaction.reply({ embeds: [createErrorEmbed('Keine Berechtigung', 'Du benötigst Admin- oder Justiz-Rechte.')], ephemeral: true });
      return;
    }
    // Embed-spezifische Aktionen werden vom /embed command behandelt
    await interaction.reply({ embeds: [createInfoEmbed('Hinweis', 'Nutze `/embed erstellen` zum Erstellen von Embeds.')], ephemeral: true });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HILFSMETHODEN
  // ═══════════════════════════════════════════════════════════════════════════
  private safeField(interaction: ModalSubmitInteraction, customId: string): string {
    try { return interaction.fields.getTextInputValue(customId).trim(); } catch { return ''; }
  }

  private extractField(lines: string[], key: string): string {
    const line = lines.find(l => l.toLowerCase().startsWith(key + ':'));
    return line ? line.split(':').slice(1).join(':').trim() : '';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEMPVOICE INTERFACE HANDLER
  // ═══════════════════════════════════════════════════════════════════════════

  /** Prüft ob User Besitzer des Kanals ist (oder Admin). Gibt VoiceChannel + tempRow zurück. */
  private async tempVoiceCheck(interaction: ButtonInteraction | UserSelectMenuInteraction, member: GuildMember): Promise<{ channel: VoiceChannel; ownerId: string } | null> {
    const db = getDatabase();
    const tempRow = db.prepare('SELECT * FROM temp_voice_channels WHERE channel_id = ?')
      .get(interaction.channelId!) as { channel_id: string; owner_id: string } | undefined;

    if (!tempRow) {
      await interaction.reply({ embeds: [createErrorEmbed('Kein TempVoice-Kanal', 'Dieser Kanal ist kein temporärer Voice-Kanal.')], ephemeral: true });
      return null;
    }

    if (tempRow.owner_id !== interaction.user.id && !hasAdminPermission(member)) {
      await interaction.reply({ embeds: [createErrorEmbed('Keine Berechtigung', 'Nur der Besitzer des Kanals kann das Interface nutzen.')], ephemeral: true });
      return null;
    }

    const channel = interaction.channel as VoiceChannel;
    if (!channel || channel.type !== ChannelType.GuildVoice) {
      await interaction.reply({ embeds: [createErrorEmbed('Fehler', 'Voice-Kanal nicht gefunden.')], ephemeral: true });
      return null;
    }

    return { channel, ownerId: tempRow.owner_id };
  }

  private async handleTempVoiceButton(interaction: ButtonInteraction, member: GuildMember): Promise<void> {
    const id = interaction.customId;

    // ── Umbenennen → Modal ──
    if (id === 'tempvoice_rename') {
      const check = await this.tempVoiceCheck(interaction, member);
      if (!check) return;
      const modal = new ModalBuilder().setCustomId('modal_tempvoice_rename').setTitle('Kanal umbenennen')
        .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('name').setLabel('Kanalname (Präfix 🎭│ wird automatisch)')
            .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(90)
            .setPlaceholder('z.B. Gaming Lounge')
        ));
      await interaction.showModal(modal);
      return;
    }

    // ── Benutzerlimit → Modal ──
    if (id === 'tempvoice_limit') {
      const check = await this.tempVoiceCheck(interaction, member);
      if (!check) return;
      const modal = new ModalBuilder().setCustomId('modal_tempvoice_limit').setTitle('Benutzerlimit setzen')
        .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('limit').setLabel('Max. Benutzer (0 = unbegrenzt, max. 99)')
            .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(2)
            .setPlaceholder('z.B. 5')
        ));
      await interaction.showModal(modal);
      return;
    }

    // ── Privatsphäre → Kanal sperren/entsperren (Toggle) ──
    if (id === 'tempvoice_privacy') {
      const check = await this.tempVoiceCheck(interaction, member);
      if (!check) return;
      const everyone = check.channel.guild.roles.everyone;
      const current = check.channel.permissionOverwrites.cache.get(everyone.id);
      const istGesperrt = current?.deny.has(PermissionFlagsBits.Connect);

      await check.channel.permissionOverwrites.edit(everyone, { Connect: istGesperrt ? null : false });
      await interaction.reply({
        embeds: [createSuccessEmbed(
          istGesperrt ? '🔓 Kanal entsperrt' : '🔒 Kanal gesperrt',
          istGesperrt ? 'Jeder kann den Kanal jetzt betreten.' : 'Nur berechtigte Benutzer können den Kanal betreten.'
        )],
        ephemeral: true,
      });
      return;
    }

    // ── Benutzer-Aktionen → UserSelectMenu ──
    const userSelectActions: Record<string, { titel: string; placeholder: string }> = {
      tempvoice_add:        { titel: '➕ Benutzer hinzufügen',   placeholder: 'Benutzer auswählen der Zugriff bekommt...' },
      tempvoice_remove:     { titel: '➖ Zugriff entfernen',     placeholder: 'Benutzer auswählen dem Zugriff entzogen wird...' },
      tempvoice_disconnect: { titel: '🔇 Benutzer trennen',      placeholder: 'Benutzer auswählen der getrennt wird...' },
      tempvoice_block:      { titel: '🚫 Benutzer blockieren',   placeholder: 'Benutzer auswählen der blockiert wird...' },
      tempvoice_unblock:    { titel: '✅ Benutzer entblockieren', placeholder: 'Benutzer auswählen dessen Sperre aufgehoben wird...' },
    };

    if (userSelectActions[id]) {
      const check = await this.tempVoiceCheck(interaction, member);
      if (!check) return;
      const cfg = userSelectActions[id];
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(config.colors.server as ColorResolvable).setTitle(cfg.titel).setDescription('Wähle einen Benutzer aus dem Menü.')],
        components: [new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
          new UserSelectMenuBuilder().setCustomId(`userselect_${id}`).setPlaceholder(cfg.placeholder).setMinValues(1).setMaxValues(1)
        )],
        ephemeral: true,
      });
      return;
    }

    // ── Kanal übernehmen (wenn Besitzer weg ist) ──
    if (id === 'tempvoice_claim') {
      const db = getDatabase();
      const tempRow = db.prepare('SELECT * FROM temp_voice_channels WHERE channel_id = ?')
        .get(interaction.channelId!) as { owner_id: string } | undefined;
      if (!tempRow) {
        await interaction.reply({ embeds: [createErrorEmbed('Fehler', 'Kein TempVoice-Kanal.')], ephemeral: true });
        return;
      }
      const channel = interaction.channel as VoiceChannel;
      // Besitzer noch im Kanal? Dann nicht übernehmbar
      if (channel.members.has(tempRow.owner_id) && tempRow.owner_id !== interaction.user.id) {
        await interaction.reply({ embeds: [createErrorEmbed('Nicht möglich', 'Der Besitzer ist noch im Kanal.')], ephemeral: true });
        return;
      }
      db.prepare('UPDATE temp_voice_channels SET owner_id = ? WHERE channel_id = ?').run(interaction.user.id, interaction.channelId!);
      await channel.permissionOverwrites.edit(interaction.user.id, {
        ManageChannels: true, MoveMembers: true, MuteMembers: true, DeafenMembers: true,
      });
      await interaction.reply({ embeds: [createSuccessEmbed('👑 Kanal übernommen', `${interaction.user} ist jetzt Besitzer dieses Kanals.`)], ephemeral: true });
      return;
    }
  }

  private async handleUserSelect(interaction: UserSelectMenuInteraction): Promise<void> {
    const member = interaction.member as GuildMember;
    if (!interaction.customId.startsWith('userselect_tempvoice_')) return;

    const check = await this.tempVoiceCheck(interaction, member);
    if (!check) return;

    const targetUser = interaction.users.first();
    if (!targetUser) {
      await interaction.reply({ embeds: [createErrorEmbed('Fehler', 'Kein Benutzer ausgewählt.')], ephemeral: true });
      return;
    }

    const channel = check.channel;
    const aktion = interaction.customId.replace('userselect_', '');

    try {
      if (aktion === 'tempvoice_add') {
        await channel.permissionOverwrites.edit(targetUser.id, { Connect: true, ViewChannel: true });
        await interaction.update({ embeds: [createSuccessEmbed('➕ Hinzugefügt', `${targetUser} hat jetzt Zugriff auf den Kanal.`)], components: [] });

      } else if (aktion === 'tempvoice_remove') {
        await channel.permissionOverwrites.delete(targetUser.id);
        await interaction.update({ embeds: [createSuccessEmbed('➖ Entfernt', `${targetUser} hat keinen speziellen Zugriff mehr.`)], components: [] });

      } else if (aktion === 'tempvoice_disconnect') {
        const targetMember = await channel.guild.members.fetch(targetUser.id).catch(() => null);
        if (targetMember?.voice.channelId === channel.id) {
          await targetMember.voice.disconnect('TempVoice: getrennt durch Besitzer');
          await interaction.update({ embeds: [createSuccessEmbed('🔇 Getrennt', `${targetUser} wurde aus dem Kanal getrennt.`)], components: [] });
        } else {
          await interaction.update({ embeds: [createErrorEmbed('Nicht im Kanal', `${targetUser} ist nicht in diesem Kanal.`)], components: [] });
        }

      } else if (aktion === 'tempvoice_block') {
        await channel.permissionOverwrites.edit(targetUser.id, { Connect: false });
        const targetMember = await channel.guild.members.fetch(targetUser.id).catch(() => null);
        if (targetMember?.voice.channelId === channel.id) {
          await targetMember.voice.disconnect('TempVoice: blockiert');
        }
        await interaction.update({ embeds: [createSuccessEmbed('🚫 Blockiert', `${targetUser} wurde blockiert und kann den Kanal nicht mehr betreten.`)], components: [] });

      } else if (aktion === 'tempvoice_unblock') {
        await channel.permissionOverwrites.delete(targetUser.id);
        await interaction.update({ embeds: [createSuccessEmbed('✅ Entblockiert', `Die Sperre für ${targetUser} wurde aufgehoben.`)], components: [] });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
      await interaction.update({ embeds: [createErrorEmbed('Fehler', msg)], components: [] });
    }
  }

  private async handleTempVoiceModal(interaction: ModalSubmitInteraction): Promise<void> {
    const member = interaction.member as GuildMember;
    const db = getDatabase();
    const tempRow = db.prepare('SELECT * FROM temp_voice_channels WHERE channel_id = ?')
      .get(interaction.channelId!) as { owner_id: string } | undefined;

    if (!tempRow) {
      await interaction.reply({ embeds: [createErrorEmbed('Fehler', 'Kein TempVoice-Kanal.')], ephemeral: true });
      return;
    }
    if (tempRow.owner_id !== interaction.user.id && !hasAdminPermission(member)) {
      await interaction.reply({ embeds: [createErrorEmbed('Keine Berechtigung', 'Nur der Besitzer kann das ändern.')], ephemeral: true });
      return;
    }

    const channel = interaction.channel as VoiceChannel;

    if (interaction.customId === 'modal_tempvoice_rename') {
      let eingabe = interaction.fields.getTextInputValue('name').trim();
      // Falls User das Präfix selbst mit eingegeben hat, entfernen wir es
      eingabe = eingabe.replace(/^🎭│\s*/, '').trim();
      const name = `🎭│ ${eingabe}`;
      await channel.setName(name);
      db.prepare('UPDATE temp_voice_channels SET channel_name = ? WHERE channel_id = ?').run(name, interaction.channelId!);
      await interaction.reply({ embeds: [createSuccessEmbed('✏️ Umbenannt', `Kanal heißt jetzt **${name}**.`)], ephemeral: true });
      return;
    }

    if (interaction.customId === 'modal_tempvoice_limit') {
      const limit = Math.min(99, Math.max(0, parseInt(interaction.fields.getTextInputValue('limit')) || 0));
      await channel.setUserLimit(limit);
      await interaction.reply({
        embeds: [createSuccessEmbed('👥 Benutzerlimit gesetzt', limit === 0 ? 'Der Kanal hat jetzt **kein Limit**.' : `Der Kanal ist auf **${limit} Benutzer** begrenzt.`)],
        ephemeral: true,
      });
      return;
    }
  }
}

// ── Draft-Tabellen-Interface ──────────────────────────────────────────────────
interface DraftRow {
  id: number;
  guild_id: string;
  user_id: string;
  channel_id: string;
  beschuldigter: string;
  roblox_name: string;
  roblox_id: string;
  fraktion: string;
  geburtsdatum: string;
  verfahrensart: string;
  zustaendiges_gericht: string;
  vorwurf: string;
  tatzeit: string;
  tatort: string;
  sachverhalt: string;
  beweise: string;
  richter: string;
  staatsanwalt: string;
  anwalt: string;
  geschaedigter: string;
  zeugen: string;
  ermittler: string;
  weitere_beteiligte: string;
  zusatzinfo: string;
}
