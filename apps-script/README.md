# Mechviz Google Apps Script deployment

This folder is the complete Mechviz SaaS application. It uses:

- Google Apps Script for the web application and server-side API
- The bound **Mechviz Database** Google Sheet for all structured data
- Private Google Drive folders for source images and generated renders
- OpenAI `gpt-image-2` for image-based mechanical concept rendering and revisions

## The only secret you add

In Apps Script open **Project Settings → Script Properties** and add:

| Property | Value |
|---|---|
| `mechviz` | Your OpenAI API key |

Never place the key in the Sheet, GitHub, or browser code.

## Install

1. Open the **Mechviz Database** Google Sheet.
2. Choose **Extensions → Apps Script**.
3. Create the files from this folder using the exact names shown here.
4. Open **Project Settings** and enable **Show `appsscript.json` manifest file in editor**.
5. Replace the manifest with `appsscript.json` from this folder.
6. Add the Script Property `mechviz` with your OpenAI API key.
7. Run `setupMechviz()` once and approve the requested permissions.
8. Run `verifyMechviz()` and confirm `ready: true` in the execution log.
9. Choose **Deploy → New deployment → Web app**.
10. Execute as **Me** and grant access to **Anyone**.
11. Open the deployment URL.

## What setupMechviz() creates

- Private `Mechviz Source Images` Drive folder
- Private `Mechviz Generated Renders` Drive folder
- Sheet settings and folder IDs
- Apps Script menu inside the Sheet
- Admin role for the first registered account

## Important limitation

Mechviz produces AI-generated 3D-looking concept images. It does not produce certified CAD, STL, STEP, manufacturing drawings, structural calculations, or guaranteed dimensions.
