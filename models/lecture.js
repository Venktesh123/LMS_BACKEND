const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class Lecture extends Model {
    static associate(models) {
      Lecture.belongsTo(models.Course, {
        foreignKey: "courseId",
        as: "course",
      });
    }
  }

  Lecture.init(
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
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      videoUrl: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      videoKey: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      isReviewed: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      reviewDeadline: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: () => {
          const date = new Date();
          date.setDate(date.getDate() + 7);
          return date;
        },
      },
    },
    {
      sequelize,
      modelName: "Lecture",
      hooks: {
        beforeSave: (lecture) => {
          if (
            !lecture.isReviewed &&
            lecture.reviewDeadline &&
            new Date() >= lecture.reviewDeadline
          ) {
            lecture.isReviewed = true;
          }
        },
      },
    }
  );

  return Lecture;
};
