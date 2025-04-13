const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class CreditPoints extends Model {
    static associate(models) {
      CreditPoints.belongsTo(models.Course, {
        foreignKey: "courseId",
        as: "course",
      });
    }
  }

  CreditPoints.init(
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
      lecture: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      tutorial: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      practical: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      project: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      sequelize,
      modelName: "CreditPoints",
    }
  );

  return CreditPoints;
};
