import Service from "./service.model.js";

export const getServices = async (req, res, next) => {
  try {
    const services = await Service.find({}).populate("departments", "name");
    res.json(services);
  } catch (error) {
    next(error);
  }
};

export const createService = async (req, res, next) => {
  try {
    const { name, departments, price, description, reportDeliveryTime } = req.body;
    if (!name || !departments || !price || !reportDeliveryTime) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const service = await Service.create({ name, departments, price, description, reportDeliveryTime });
    res.status(201).json(service);
  } catch (error) {
    next(error);
  }
};

export const updateService = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, departments, price, description, reportDeliveryTime } = req.body;
    const service = await Service.findByIdAndUpdate(
      id,
      { name, departments, price, description, reportDeliveryTime },
      { new: true }
    );
    if (!service) return res.status(404).json({ message: "Service not found" });
    res.json(service);
  } catch (error) {
    next(error);
  }
};

export const deleteService = async (req, res, next) => {
  try {
    const { id } = req.params;
    const service = await Service.findByIdAndDelete(id);
    if (!service) return res.status(404).json({ message: "Service not found" });
    res.json({ message: "Service deleted successfully" });
  } catch (error) {
    next(error);
  }
};
