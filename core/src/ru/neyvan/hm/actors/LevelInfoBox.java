package ru.neyvan.hm.actors;

import com.badlogic.gdx.scenes.scene2d.ui.Label;
import com.badlogic.gdx.scenes.scene2d.ui.Skin;

import ru.neyvan.hm.HM;
import ru.neyvan.hm.levels.LevelNumber;

public class LevelInfoBox extends Label {

    public LevelInfoBox(Skin skin, String styleName){
        super("Level", skin, styleName);
    }

    public void setInfo(LevelNumber levelNumber) {
        String text = HM.game.bundle.format("level", levelNumber.getEpisode(), levelNumber.getLevel());
        setText(text);
    }
}
