package ru.neyvan.hm.actors;

import com.badlogic.gdx.scenes.scene2d.ui.Label;
import com.badlogic.gdx.scenes.scene2d.ui.Skin;

public class ScoreBox extends Label {

    private int referenceScore;
    private int nowScore;

    public ScoreBox(Skin skin, String styleName) {
        super("0", skin, styleName);
    }


    @Override
    public void act(float delta){
        super.act(delta);
        if(nowScore != referenceScore){
            if(nowScore < referenceScore) nowScore++;
            else nowScore--;
            setText(Integer.toString(nowScore));
        }
    }

    public void setBeginScore(int beginScore) {
        nowScore = beginScore;
        referenceScore = beginScore;
    }
    public void setScore(int score) {
        referenceScore = score;
    }

}
