export default function checkRequiredFields(fields) {
  const missingFields = Object.entries(fields)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missingFields.length > 0) {
    const error = new Error(
      `Missing required fields: ${missingFields.join(", ")}`
    );
    error.statusCode = 400;
    error.missingFields = missingFields;
    throw error;
  }
}
