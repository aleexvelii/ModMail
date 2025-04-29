const { Client, GatewayIntentBits, Partials, ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, Events } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

const TICKET_CATEGORY_ID = '1366166525785931827'; // ID de categoría donde se crean los tickets
const TICKET_NOTIF_CHANNEL_ID = '1366296124868137050'; // Canal donde se notifica al staff

client.once('ready', () => {
  console.log(`🟢 Bot iniciado como ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.channel.type !== ChannelType.DM || message.author.bot) return;

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('seleccionar_categoria')
      .setPlaceholder('Selecciona una categoría')
      .addOptions([
        { label: '🛡️ Moderación', description: 'Problemas con usuarios o staff', value: 'moderacion' },
        { label: '🧰 Utilidad', description: 'Dudas sobre comandos o funciones', value: 'utilidad' },
        { label: '❓ Sugerencias', description: 'Ideas para mejorar el servidor', value: 'sugerencias' },
        { label: '📦 Otros', description: 'Otra consulta o problema', value: 'otros' }
      ])
  );

  await message.author.send({
    content: 'Hola 👋 ¿En qué te podemos ayudar? Selecciona una categoría:',
    components: [row]
  });
});

client.on('interactionCreate', async (interaction) => {
  // SELECCIÓN DE CATEGORÍA
  if (interaction.isStringSelectMenu() && interaction.customId === 'seleccionar_categoria') {
    const tipo = interaction.values[0];

    const modal = new ModalBuilder()
      .setCustomId(`formulario_ticket_${tipo}`)
      .setTitle(`Formulario - ${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`);

    const input = new TextInputBuilder()
      .setCustomId('motivo_ticket')
      .setLabel('Describe tu situación:')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setPlaceholder('Escribe aquí tu mensaje...');

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
  }

  // ENVÍO DEL FORMULARIO
  if (interaction.isModalSubmit() && interaction.customId.startsWith('formulario_ticket_')) {
    const tipo = interaction.customId.replace('formulario_ticket_', '');
    const motivo = interaction.fields.getTextInputValue('motivo_ticket');

    const guild = client.guilds.cache.first(); // Solo si el bot está en 1 servidor
    const miembro = await guild.members.fetch(interaction.user.id);

    const canal = await guild.channels.create({
      name: `ticket-${interaction.user.username}`.toLowerCase(),
      type: ChannelType.GuildText,
      parent: TICKET_CATEGORY_ID,
      permissionOverwrites: [
        {
          id: guild.roles.everyone,
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: interaction.user.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
        },
        {
          id: guild.roles.cache.find(r => r.name.toLowerCase().includes('staff'))?.id || '1361702213747212499',
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
        }
      ]
    });

    const cerrarButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('cerrar_ticket')
        .setLabel('Cerrar Ticket')
        .setStyle(ButtonStyle.Danger)
    );

    await canal.send({
      content: `📬 Nuevo ticket de <@${interaction.user.id}>\n📂 Categoría: **${tipo}**\n💬 Mensaje: ${motivo}`,
      components: [cerrarButton]
    });

    const notiChannel = await guild.channels.fetch(TICKET_NOTIF_CHANNEL_ID);
    if (notiChannel) {
      notiChannel.send({
        content: `📨 <@${interaction.user.id}> ha abierto un nuevo ticket sobre **${tipo}**.`
      });
    }

    await interaction.reply({
      content: '✅ ¡Gracias! Se ha creado un canal donde podrás comunicarte con el staff.',
      ephemeral: true
    });
  }

  // CERRAR TICKET
  if (interaction.isButton() && interaction.customId === 'cerrar_ticket') {
    const miembro = await interaction.guild.members.fetch(interaction.user.id);
    if (!miembro.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({
        content: '❌ No tienes permiso para cerrar este ticket.',
        ephemeral: true
      });
    }

    await interaction.channel.delete();
  }
});

const token = process.env.TOKEN;