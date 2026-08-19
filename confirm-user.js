const https = require("https");
const http = require("http");

const email = "testuser123@gmail.com";
const supabaseUrl = "https://xjfbbanwjvjruoyofkek.supabase.co";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqZmJiYW53anZqcnVveW9ma2VrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTkxNzY0NCwiZXhwIjoyMTAxNDkzNjQ0fQ.AAjnNoOIjTzSZugyFK0JgsxfLzLfzTEDLqjBl4QMHcg";

// First, get the user by email
const getUrl = new URL(
  `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`
);

console.log("🔍 Step 1: Fetching user by email...");

const getOptions = {
  hostname: getUrl.hostname,
  path: getUrl.pathname + getUrl.search,
  method: "GET",
  headers: {
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  },
};

https.request(getOptions, (res) => {
  let data = "";

  res.on("data", (chunk) => {
    data += chunk;
  });

  res.on("end", () => {
    try {
      const users = JSON.parse(data);

      if (!Array.isArray(users) || users.length === 0) {
        console.log("❌ User not found");
        process.exit(1);
      }

      const user = users[0];
      console.log(`✅ Found user: ${user.email} (ID: ${user.id})`);
      console.log(`   Email confirmed: ${user.email_confirmed_at ? 'Yes' : 'No'}`);

      // Now update the user to confirm email
      console.log("\n🔍 Step 2: Confirming email...");

      const updateUrl = new URL(
        `${supabaseUrl}/auth/v1/admin/users/${user.id}`
      );

      const updateBody = JSON.stringify({
        email_confirm: true,
      });

      const updateOptions = {
        hostname: updateUrl.hostname,
        path: updateUrl.pathname,
        method: "PUT",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
          "Content-Length": updateBody.length,
        },
      };

      const updateReq = https.request(updateOptions, (updateRes) => {
        let updateData = "";

        updateRes.on("data", (chunk) => {
          updateData += chunk;
        });

        updateRes.on("end", () => {
          try {
            const updatedUser = JSON.parse(updateData);
            console.log(`✅ Email confirmed for: ${updatedUser.email}`);
            console.log("\n🎉 USER READY TO LOGIN!");
            console.log("\n📧 Email: testuser123@gmail.com");
            console.log("🔐 Password: TestPassword123!");
            console.log("\n✨ You can now log in at http://localhost:3000/login");
          } catch (err) {
            console.error("❌ Error parsing response:", err);
            console.error("Response:", updateData);
          }
        });
      });

      updateReq.on("error", (err) => {
        console.error("❌ Request error:", err);
      });

      updateReq.write(updateBody);
      updateReq.end();

    } catch (err) {
      console.error("❌ Error parsing user response:", err);
      console.error("Response:", data);
    }
  });
}).on("error", (err) => {
  console.error("❌ Request error:", err);
  process.exit(1);
});
