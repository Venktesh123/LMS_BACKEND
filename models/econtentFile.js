const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class EContentFile extends Model {
    static associate(models) {
      EContentFile.belongsTo(models.EContentModule, {
        foreignKey: "moduleId",
        as: "module",
      });
    }
  }

  EContentFile.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      moduleId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "EContentModules",
          key: "id",
        },
      },
      fileType: {
        type: DataTypes.ENUM("pdf", "ppt", "pptx", "other"),
        allowNull: false,
      },
      fileUrl: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      fileKey: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      fileName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      uploadDate: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      modelName: "EContentFile",
    }
  );

  return EContentFile;
};
