const { Event } = require("../models");

class EventRepository {
  async create(eventData) {
    return await Event.create(eventData);
  }

  async findAll() {
    return await Event.findAll({
      order: [["date", "ASC"]],
    });
  }

  async findById(id) {
    return await Event.findByPk(id);
  }

  async update(id, eventData) {
    const event = await Event.findByPk(id);

    if (!event) {
      return null;
    }

    return await event.update(eventData);
  }

  async delete(id) {
    const event = await Event.findByPk(id);

    if (!event) {
      return false;
    }

    await event.destroy();
    return true;
  }
}

module.exports = new EventRepository();
