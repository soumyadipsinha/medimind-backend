import Doctor from "../api/doctor/doctor.model.js";
import Patient from "../api/patient/patient.model.js";

export const associateDoctorAndPatient = async (doctorId, patientId) => {
  try {
    if (!doctorId || !patientId) return;

    // Add patient to doctor's patients list if not already present
    await Doctor.findByIdAndUpdate(
      doctorId,
      { $addToSet: { patients: patientId } }
    );

    // Add doctor to patient's doctors list if not already present
    await Patient.findByIdAndUpdate(
      patientId,
      { $addToSet: { doctors: doctorId } }
    );
  } catch (err) {
    console.error("Error associating doctor and patient in db:", err);
  }
};
