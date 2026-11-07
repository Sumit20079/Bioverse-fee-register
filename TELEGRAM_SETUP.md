# Telegram reminders: one-time setup

1. **Supabase** -> SQL Editor: paste `supabase/add-telegram.sql` and Run.
2. **Vercel** -> the project -> Settings -> Environment Variables. Add (all environments), then **Redeploy**:
   - `TELEGRAM_BOT_TOKEN`: the token from @BotFather (keep it secret)
   - `TELEGRAM_WEBHOOK_SECRET`: any long random string you make up
   - `CRON_SECRET`: another long random string
   - `SUPABASE_SERVICE_KEY`: Supabase -> Project Settings -> API -> `service_role` key (secret, full access: never put it in the app or share it)
3. Connect the bot: open `https://<your-site>/api/telegram?setup=<CRON_SECRET>` once in a browser. It should answer `{"ok":true,...}`.
4. In the app: Settings -> Telegram reminders. Open a student -> Invite, and press Start in Telegram to test with your own number.

The timer runs every day at 9:00 am IST (`vercel.json`) and sends according to Settings -> Telegram reminders.
