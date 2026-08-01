# Jenkins guide images

The Jenkins "User Management" guide loads a screenshot for each step from this
folder. Until a `.png` is present, the app shows the matching `.svg` diagram as a
fallback (no broken images).

To use your own screenshots, save them here with these exact names:

| Save your screenshot as            | Step it illustrates |
|------------------------------------|---------------------|
| `manage-jenkins-users.png`         | Manage Jenkins → Users tile |
| `users-list.png`                   | Users database + "+ Create User" |
| `install-plugin.png`               | Role-based Authorization Strategy plugin |
| `security-before.png`              | Authorization = "Logged-in users can do anything" |
| `security-after.png`               | Authorization changed to "Role-Based Strategy" (Save) |
| `manage-and-assign-roles.png`      | New "Manage and Assign Roles" tile |
| `manage-roles.png`                 | Manage Roles — global roles & permission matrix |
| `assign-roles.png`                 | Assign Roles — users mapped to roles |
| `test-incognito.png`               | Incognito "Sign in to Jenkins" |
| `logged-in-dashboard.png`          | Signed-in, role-limited dashboard |

That's all — no code changes needed. After adding files, redeploy the web app
(or `docker compose up --build`) to publish them. The `.svg` files are the
fallback diagrams and can stay.
