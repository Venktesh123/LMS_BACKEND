const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class EContentModule extends Model {
    static associate(models) {
      EContentModule.belongsTo(models.EContent, {
        foreignKey: "eContentId",
        as: "eContent",
      });

      EContentModule.hasMany(models.EContentFile, {
        foreignKey: "moduleId",
        as: "files",
      });
    }
  }

  EContentModule.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      eContentId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "EContents",
          key: "id",
        },
      },
      moduleNumber: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      moduleTitle: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      link: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "EContentModule",
    }
  );

  return EContentModule;
};
