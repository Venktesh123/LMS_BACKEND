const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class EContent extends Model {
    static associate(models) {
      EContent.belongsTo(models.Course, {
        foreignKey: "courseId",
        as: "course",
      });

      EContent.hasMany(models.EContentModule, {
        foreignKey: "eContentId",
        as: "modules",
      });
    }
  }

  EContent.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      courseId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "Courses",
          key: "id",
        },
      },
    },
    {
      sequelize,
      modelName: "EContent",
    }
  );

  return EContent;
};
