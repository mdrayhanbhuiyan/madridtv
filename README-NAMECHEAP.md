# Namecheap Hosting Guide / নেমচিপ হোস্টিং গাইড

This guide explains how to host this custom full-stack React + Express live IPTV player application on **Namecheap Shared Hosting (with cPanel Node.js Selector)**.

এই গাইডটিতে দেখানো হয়েছে কীভাবে আপনি এই ফুল-স্ট্যাক রিয়্যাক্ট + এক্সপ্রেস লাইভ আইপিটিভি প্লেয়ার অ্যাপ্লিকেশনটি **নেইমচিপ শেয়ার্ড হোস্টিং (cPanel Node.js Selector সহ)** হোস্ট করবেন।

---

## English Version: Deployment Steps

### 1. Build the Application locally (or in the cPanel Terminal)
Before deploying, the application needs to compile standard production files into static assets (`dist/` folder) and bundle the server using:
```bash
npm run build
```
This produces `dist/` containing `index.html` alongside your UI assets, and `dist/server.cjs` which is your bundled Express server.

### 2. Prepare Zip Archive for Upload
Create a `.zip` archive containing all files in this project directory.
**Crucial:** Exclude your local `node_modules/` and any `.git/` folders to keep the size small. Ensure you include:
- `dist/` (contains files generated during build)
- `package.json`
- `app.js` (Created specifically as Namecheap's entrypoint startup file)
- `server.ts` & `/src` (for safety, though only built files in `dist/` are executed at runtime)

### 3. Create Node.js Application in Namecheap cPanel
1. Log into your **Namecheap cPanel**.
2. Search for **"Setup Node.js App"** and click on it.
3. Click on the **"Create Application"** button.
4. Set the following fields:
   - **Node.js version**: Choose the latest stable available version (e.g., `18.x` or `20.x`).
   - **Application Mode**: Change to **Production**.
   - **Application root**: Enter the folder name where you uploaded/will upload the file (e.g., `iptv-app`).
   - **Application URL**: Select your domain or subdomain (e.g., `iptv.yourdomain.com`).
   - **Application startup file**: Set this to **`app.js`** (the file we created for you).
5. Click **Create** at the top right.

### 4. Upload Files via File Manager
1. In cPanel, open **File Manager**.
2. Go to your application root directory (e.g., `iptv-app` as entered in Step 3).
3. Delete any default files generated there (like `app.js` if it was auto-created by cPanel).
4. Upload the `.zip` archive you prepared in Step 2.
5. Extract the `.zip` archive directly in that folder. Ensure `app.js` and `package.json` are in the main folder.

### 5. Install Dependencies and Complete Setup
1. Go back to cPanel **Setup Node.js App** page and click the Edit pencil icon next to your app.
2. Scroll to the **"Detected configuration files"** section.
3. Click the **"Run JS build"** or use the **"Run npm install"** button to install all required dependencies directly on standard cloud storage.
4. Once completed, click **Restart** to update the server.
5. Visit your domain and your live IPTV Player is ready to stream!

---

## বাংলা সংস্করণ: হোস্টিং করার ধাপ সমূহ

### ১. অ্যাপ্লিকেশন প্রস্তুত করুন (Build Step)
হোস্ট করার পূর্বে আপনার লোকাল কম্পিউটারে অথবা cpanel টার্মিনালে অ্যাপটির প্রোডাকশন কোড বিল্ড তৈরি করে নিন। নিচের কমান্ডটি চালান:
```bash
npm run build
```
এটি রান করলে `dist/` ফোল্ডারে আপনার ওয়েব UI এসেম্বল হবে এবং `dist/server.cjs` মেইন সার্ভার তৈরি হবে।

### ২. জিপ ফাইল তৈরি করুন
প্রোজেক্টের সব ফাইল দিয়ে একটি `.zip` তৈরি করুন।
**সতর্কতা:** ভুল করেও `node_modules/` ফোল্ডার জিপ করবেন না। জিপ ফাইলের মধ্যে নিচে উল্লেখিত ফাইলগুলো নিশ্চিতভাবে রাখবেন:
- `dist/` (ডিস্ট্রিবিউশন ফোল্ডার যা বিল্ড রান করার পর তৈরি হয়েছে)
- `package.json`
- `app.js` (নেইমচিপ এ অ্যাপ্লিকেশন চালু করার জন্য প্রয়োজনীয় বিশেষ স্টার্টআপ ফাইল)
- `server.ts` এবং `/src`

### ৩. নেইমচিপ cPanel থেকে Node.js অ্যাপ্লিকেশন তৈরি প্রসেস
১. আপনার **Namecheap cPanel** এ লগইন করুন।
২. সার্চ বক্সে টাইপ করুন **"Setup Node.js App"** এবং সফটওয়্যারটি ওপেন করুন।
৩. ডানপাশের **"Create Application"** বাটনে ক্লিক করুন।
৪. নিচের তথ্যগুলো দিয়ে ফর্মটি পূরণ করুন:
   - **Node.js version**: লেটেস্ট স্টেবল ভার্সনটি নির্বাচন করুন (যেমন: `18.x` অথবা `20.x`)।
   - **Application Mode**: পরিবর্তন করে **Production** সিলেক্ট করুন।
   - **Application root**: আপনি যেখানে ফাইল আপলোড করতে চান সেই ফোল্ডারের নাম দিন (যেমন: `iptv-app`)।
   - **Application URL**: আপনার ডোমেইন বা সাবডোমেইন সিলেক্ট করুন (যেমন: `iptv.yourdomain.com`)।
   - **Application startup file**: এটি দিন **`app.js`** (আমরা এই হোস্টিং স্টার্টআপ ফাইলটি আপনার জন্য তৈরি করে দিয়েছি)।
৫. ডানপাশের **Create** বাটনে ক্লিক করে সেভ করুন।

### ৪. ফাইল ম্যানেজার দিয়ে আপলোড করুন
১. cPanel থেকে **File Manager** ওপেন করুন।
২. আপনার অ্যাপলিকেশন ডিরেক্টরিতে যান (যেমন: `iptv-app` ফোল্ডার)।
৩. নেইমচিপের তরফ থেকে কোনো অটো তৈরি করা `app.js` বা ফাইল থাকলে তা ডিলিট করে দিন।
৪. আপনার তৈরি করা `.zip` ফাইলটি আপলোড করুন।
৫. জিপ ফাইলটি ওই ফোল্ডারে Extract (আনজিপ) করুন। নিশ্চিত হোন যে `app.js` এবং `package.json` সরাসরি রুট ডিরেক্টরিতে রয়েছে।

### ৫. ডিপেন্ডেন্সি ইন্সটল এবং সাকসেস রান
১. cPanel এর **Setup Node.js App** পেজে ফিরে যান এবং তৈরি করা অ্যাপটির পেনসিল আইকন (Edit) এ ক্লিক করুন।
২. একটু নিচে স্ক্রল করলে **"Detected configuration files"** অপশন দেখতে পাবেন।
৩. সেখানে থাকা **"Run npm install"** বাটনে ক্লিক করুন যাতে হোস্টিং সার্ভারে সব ডিপেনডেন্সি অটোমেটিক ডউনলোড হয়ে ইন্সটল হয়ে যায়।
৪. ডিপেন্ডেন্সি ডাউনলোড শেষ হলে উপরের পেজ থেকে **"Restart"** বাটনে ক্লিক করে অ্যাপটি রিস্টার্ট করুন।
৫. এখন আপনার ডোমেইনে প্রবেশ করলেই দেখতে পাবেন আপনার সুন্দর ও পলিশড লাইভ আইপিটিভি প্লেয়ার সম্পূর্ণ প্রস্তুত এবং লাইভ রান করছে!
