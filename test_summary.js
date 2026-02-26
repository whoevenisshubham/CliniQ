const emr = {
    symptoms: ["fever", "headache"],
    vitals: { temperature: 101 },
    chief_complaint: "fever for 2 days"
};

fetch("http://localhost:3000/api/patient-summary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ emr, patientName: "Rahul", language: "en", consultationId: "test" })
})
    .then(res => Promise.all([res.status, res.json()]))
    .then(([status, body]) => console.log("Status:", status, "\nBody:", body))
    .catch(err => console.error(err));
