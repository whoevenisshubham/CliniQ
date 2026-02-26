const transcript = "Hello hello you have a high BP of 150 over 90. Your heart rate is 90 beats per minute. Your temperature is 98.5 and weight of 75 kgs. Patient reports having fever for two days.";

fetch("http://localhost:3000/api/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript, consultationId: "test-123" })
})
    .then(res => Promise.all([res.status, res.json()]))
    .then(([status, body]) => console.log("Status:", status, "\nBody:", JSON.stringify(body, null, 2)))
    .catch(err => console.error("Error:", err));
