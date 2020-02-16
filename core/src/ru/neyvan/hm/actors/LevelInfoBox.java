package ru.neyvan.hm.actors;

import com.badlogic.gdx.scenes.scene2d.ui.Label;
import com.badlogic.gdx.scenes.scene2d.ui.Skin;

import ru.neyvan.hm.levels.LevelNumber;

public class LevelInfoBox extends Label {

    public LevelInfoBox(Skin skin, String styleName){
        super("Level", skin, styleName);
    }

    public void setInfo(LevelNumber levelNumber) {
        String text = "Level " + levelNumber.getEpisode() + "." + levelNumber.getLevel();
        setText(text);
    }
}
