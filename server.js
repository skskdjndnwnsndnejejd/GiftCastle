import { Telegraf, Markup } from "telegraf";
import fs from "fs-extra";
import dotenv from "dotenv";

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const OWNER_ID = Number(process.env.OWNER_ID);

const balancesFile = "./balances.json";
const dealsFile = "./deals.json";

let balances = {};
let deals = {};

if (fs.existsSync(balancesFile)) balances = fs.readJsonSync(balancesFile);
if (fs.existsSync(dealsFile)) deals = fs.readJsonSync(dealsFile);

const saveData = async () => {
  await fs.writeJson(balancesFile, balances, { spaces: 2 });
  await fs.writeJson(dealsFile, deals, { spaces: 2 });
};

// ───────────────────────────────────────────────
// Генератор номеров сделок
let letter = "A";
let number = 7342;
function nextDealId() {
  const id = `#${letter}${number}`;
  number++;
  if (number > 9999) {
    letter = String.fromCharCode(letter.charCodeAt(0) + 1);
    number = 1000;
    if (letter > "Z") {
      letter = "A";
      number = 1000;
    }
  }
  return id;
}

// ───────────────────────────────────────────────
// /start
bot.start(async (ctx) => {
  const name = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
  const photo = process.env.START_PHOTO_ID || { source: "./start.jpg" };

  await ctx.replyWithPhoto(photo, {
    caption:
      `Здравствуйте, ${name}!\n\n` +
      `🏰 *Добро пожаловать в Gift Castle!*\n\n` +
      `Ваши сделки теперь под защитой надёжного гаранта. Мы обеспечиваем безопасность, прозрачность и уверенность каждой транзакции.`,
    parse_mode: "Markdown",
    ...Markup.inlineKeyboard([Markup.button.callback("Продолжить ▶️", "menu")]),
  });
});

// ───────────────────────────────────────────────
// Главное меню
bot.action("menu", async (ctx) => {
  await ctx.answerCbQuery();
  const photo = process.env.MENU_PHOTO_ID || { source: "./menu.jpg" };

  await ctx.replyWithPhoto(photo, {
    caption:
      `💎 *Gift Castle* — лучший гарант на платформе Telegram!\n\n` +
      `• Ваши сделки под нашим контролем\n` +
      `• Механизм Escrow-типа без посредников\n` +
      `• Стабильность и скорость работы 🔐`,
    parse_mode: "Markdown",
    ...Markup.inlineKeyboard([
      [Markup.button.callback("💼 Создать сделку", "create_deal")],
      [Markup.button.callback("💰 Баланс", "balance")],
      [Markup.button.url("🆘 Помощь", "https://t.me/GiftCastleRelayer")]
    ]),
  });
});

// ───────────────────────────────────────────────
// Баланс
bot.action("balance", async (ctx) => {
  await ctx.answerCbQuery();
  const id = ctx.from.id;
  const bal = balances[id] || 0;
  const photo = process.env.BALANCE_PHOTO_ID || { source: "./balance.jpg" };

  await ctx.replyWithPhoto(photo, {
    caption:
      `💰 *Ваш баланс:* ${bal.toFixed(2)} TON\n\n` +
      `Это внутренний баланс Gift Castle.\n` +
      `Для вывода обратитесь в поддержку — [@GiftCastleRelayer](https://t.me/GiftCastleRelayer).`,
    parse_mode: "Markdown",
    ...Markup.inlineKeyboard([
      [Markup.button.url("📤 Запросить вывод", "https://t.me/GiftCastleRelayer")]
    ]),
  });
});

// ───────────────────────────────────────────────
// Создать сделку
bot.action("create_deal", async (ctx) => {
  await ctx.answerCbQuery();
  const photo = process.env.SELLER_PHOTO_ID || { source: "./seller.jpg" };
  await ctx.replyWithPhoto(photo, {
    caption:
      `🧾 *Создание сделки*\n\n` +
      `Выберите свою роль в сделке:\n\n` +
      `🤝 Сделка — это соглашение между двумя сторонами, направленное на установление или изменение прав и обязанностей.`,
    parse_mode: "Markdown",
    ...Markup.inlineKeyboard([
      [Markup.button.callback("🧑‍💼 Продавец", "role_seller")],
      [Markup.button.callback("🛍️ Покупатель", "role_buyer")]
    ]),
  });
});

// ───────────────────────────────────────────────
// Продавец
bot.action("role_seller", async (ctx) => {
  await ctx.answerCbQuery();
  const photo = process.env.SELLER_PHOTO_ID || { source: "./seller.jpg" };
  await ctx.replyWithPhoto(photo, {
    caption:
      `🧑‍💼 *Продавец*\n\n` +
      `Введите данные о товаре в формате:\n\n` +
      `Тип; Название; Описание; Стоимость\n\n` +
      `_Например:_\nNFT; MoonArt #12; Редкий цифровой артефакт; 35`,
    parse_mode: "Markdown",
  });

  bot.on("message", async (msgCtx) => {
    if (!msgCtx.text.includes(";")) return;
    const [type, name, desc, priceRaw] = msgCtx.text.split(";").map((x) => x.trim());
    const price = parseFloat(priceRaw);
    const dealId = nextDealId();

    deals[dealId] = {
      id: dealId,
      seller: msgCtx.from.id,
      type,
      name,
      desc,
      price,
      status: "waiting_buyer"
    };
    await saveData();

    await msgCtx.replyWithMarkdown(
      `✅ Сделка *${dealId}* успешно создана!\n\n` +
      `• Тип: ${type}\n` +
      `• Название: ${name}\n` +
      `• Описание: ${desc}\n` +
      `• Стоимость: ${price} TON\n\n` +
      `Отправь этот номер покупателю, чтобы он присоединился.`
    );
  });
});

// ───────────────────────────────────────────────
// Покупатель
bot.action("role_buyer", async (ctx) => {
  await ctx.answerCbQuery();
  const photo = process.env.BUYER_PHOTO_ID || { source: "./buyer.jpg" };
  await ctx.replyWithPhoto(photo, {
    caption:
      `🛍️ *Покупатель*\n\nВведите номер сделки (например #A7342) чтобы присоединиться.`,
    parse_mode: "Markdown",
  });

  bot.on("message", async (msgCtx) => {
    const id = msgCtx.text.trim();
    if (!id.startsWith("#") || !deals[id]) return;

    const deal = deals[id];
    if (deal.status !== "waiting_buyer") {
      return msgCtx.reply("⚠️ Эта сделка недоступна.");
    }

    const buyer = msgCtx.from.id;
    const price = deal.price;
    const bal = balances[buyer] || 0;

    if (bal < price) {
      return msgCtx.reply("❌ Недостаточно средств для участия в сделке.");
    }

    balances[buyer] -= price;
    deal.buyer = buyer;
    deal.status = "in_progress";
    await saveData();

    await msgCtx.replyWithMarkdown(
      `✅ Вы присоединились к сделке *${id}*.\nОжидайте подтверждения от продавца.`
    );

    try {
      await bot.telegram.sendMessage(
        deal.seller,
        `💎 Покупатель @${msgCtx.from.username || buyer} присоединился к сделке ${id}.\nПередайте товар поддержке @GiftCastleRelayer.`
      );
    } catch {}
  });
});

// ───────────────────────────────────────────────
// /givebalance (только владелец)
bot.command("givebalance", async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  const args = ctx.message.text.split(" ");
  if (args.length < 3) return ctx.reply("Формат: /givebalance [user_id] [сумма]");
  const uid = args[1];
  const amt = parseFloat(args[2]);
  if (isNaN(amt)) return ctx.reply("Укажите корректную сумму.");

  balances[uid] = (balances[uid] || 0) + amt;
  await saveData();

  await ctx.reply(`✅ Баланс ${uid} пополнен на ${amt} TON`);
  try {
    await bot.telegram.sendMessage(uid, `💰 Ваш баланс пополнен на ${amt} TON`);
  } catch {}
});

// ───────────────────────────────────────────────
bot.launch();
console.log("🚀 Gift Castle запущен!");
