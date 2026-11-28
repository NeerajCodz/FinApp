---
title: Receipts and import
description: Scan a bill to fill in a transaction or group expense, and import spreadsheets of transactions through FinAI.
order: 11
---

Finapp can read a photo of a bill and fill in the form for you, and FinAI can import a whole spreadsheet of transactions in one go. Both need an internet connection.

## Scanning a receipt

**Scan receipt** is available when you add a personal transaction and when you add a group expense, on web and mobile.

- **Mobile:** take a photo with the camera or choose one from your library.
- **Web:** choose a file, use your device camera, or drag and drop an image onto the form.

The photo must be a JPEG, PNG, WebP or HEIC image up to 8 MB. While it works you'll see _Uploading your photo…_, _Reading your bill…_ and _Finding items…_.

### What gets filled in

The scanner reads the merchant, date, currency, total and individual line items, and fills them into the form:

- Line items always add up exactly to the total. Tax, tip, service charge and discounts are taken into account; if a line had to be added or adjusted to make the total match, it is marked for review.
- Fields the scanner was unsure about are highlighted so you can check them.
- If **Auto-categorise receipts** is on (Settings → AI → FinAI), a category is picked for you when the scanner is confident enough.

Nothing is saved until you submit the form. Review the highlighted fields, adjust anything you like, then save as usual. In a group expense, the line items can be used for an itemized split.

### Privacy

The photo is uploaded to Finapp's storage only for the scan and is always deleted after it has been read. Each upload must be scanned within 15 minutes; after that, choose the photo again.

### Limits and common messages

You can scan 30 receipts per day (the count resets at midnight UTC).

| Message                                                | What to do                                               |
| ------------------------------------------------------ | -------------------------------------------------------- |
| Choose a photo (JPEG, PNG, WebP or HEIC) / up to 8 MB  | Pick a supported image within the size limit             |
| We couldn't find a total on this image                 | Try a clearer, flatter photo                             |
| This bill was too long to read in one go               | Try a closer photo                                       |
| You've scanned a lot of receipts today                 | Wait until the next day                                  |
| The scanner is busy right now                          | Try again in a moment                                    |
| Receipt scanning isn't switched on for this server yet | The server has no AI key configured (self-hosted setups) |

## Importing a spreadsheet with FinAI

To bring in transactions from a bank or card statement, attach the file to a FinAI message and ask it to import it.

1. Open FinAI and attach an `.xlsx`, `.csv` or `.tsv` file (up to 10 MB). **Attach files** must be on in FinAI settings.
2. Ask, for example, "Import these transactions into my HDFC account."
3. FinAI looks at the headers and tells the server which columns hold the date, description, amount (or separate debit and credit columns), type, category, merchant and notes. The server then reads **every row itself**, so amounts are never retyped by the model.
4. You get one confirmation card summarising the import. Press **Confirm** to add the transactions.

Details worth knowing:

- Up to 1,000 rows per import.
- The account defaults to your default account. FinAI asks which account to use if that's unclear.
- Category names in the sheet are matched to your existing categories by name.
- Dates are detected automatically; day/month order can be set explicitly if needed.
- With a single amount column and no type column, negative amounts are treated as expenses when there are any negatives; otherwise every row is treated as an expense. You can tell FinAI otherwise ("these are all income").
- Rows that can't be read are reported with their sheet row number instead of being guessed.
- Confirming twice never adds the rows twice.

:::tip
For an older Excel file (`.xls`) or anything FinAI can't read, save it as `.xlsx` or `.csv` and attach it again.
:::

### PDFs and images of statements

FinAI can also read PDFs and images you attach and answer questions about them. It can prepare individual transactions from them as confirmation cards (up to 5 per reply). For large statements, export a spreadsheet from your bank and use the import above.

Attached files are deleted after the retention you choose in FinAI settings (default 24 hours). See [FinAI assistant](/guide/finai#attachments).
