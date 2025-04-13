const { EContent, EContentModule, EContentFile, Course } = require("../models");
const { Op } = require("sequelize");

class EContentRepository {
  async findByCourseId(courseId) {
    return await EContent.findOne({
      where: { courseId },
      include: [
        {
          model: EContentModule,
          as: "modules",
          include: [{ model: EContentFile, as: "files" }],
        },
      ],
    });
  }

  async create(courseId) {
    return await EContent.create({ courseId });
  }

  async createModule(moduleData) {
    return await EContentModule.create(moduleData);
  }

  async findModuleById(id) {
    return await EContentModule.findByPk(id, {
      include: [{ model: EContentFile, as: "files" }],
    });
  }

  async updateModule(id, moduleData) {
    const module = await EContentModule.findByPk(id);

    if (!module) {
      return null;
    }

    return await module.update(moduleData);
  }

  async deleteModule(id) {
    const module = await EContentModule.findByPk(id);

    if (!module) {
      return false;
    }

    await module.destroy();
    return true;
  }

  async createFile(fileData) {
    return await EContentFile.create(fileData);
  }

  async findFileById(id) {
    return await EContentFile.findByPk(id);
  }

  async deleteFile(id) {
    const file = await EContentFile.findByPk(id);

    if (!file) {
      return false;
    }

    await file.destroy();
    return true;
  }
}

module.exports = new EContentRepository();
