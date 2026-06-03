<?php
// The plain text password you want to hash
$password = "reg123";

// Generate the Bcrypt hash
$hashedPassword = password_hash($password, PASSWORD_BCRYPT);

// Output the result
echo $hashedPassword;
// Output will look like: $2y$10$92IXUNpkjO0rOQ5byMi...
?>