package ru.neyvan.hm.game;

import com.badlogic.gdx.scenes.scene2d.Actor;
import com.badlogic.gdx.scenes.scene2d.Stage;
import com.badlogic.gdx.scenes.scene2d.ui.Label;
import com.badlogic.gdx.scenes.scene2d.ui.ScrollPane;
import com.badlogic.gdx.scenes.scene2d.ui.Table;
import com.badlogic.gdx.scenes.scene2d.ui.TextButton;
import com.badlogic.gdx.scenes.scene2d.utils.ChangeListener;
import com.badlogic.gdx.scenes.scene2d.utils.TextureRegionDrawable;
import com.badlogic.gdx.utils.Align;

import ru.neyvan.hm.HM;
import ru.neyvan.hm.screens.PlayScreen;

/**
 * Created by AndyGo on 06.06.2018.
 */

public class BottomPause {
    private Label title, infoScroll;
    private Table table;
    private Table scrollTable;
    private ScrollPane scroller;
    private PlayScreen parent;
    private float time;
    private String infoText =
            "Towards to space adventures! Go through the obstacles on a space plate!\n" +
                    "The game “Flappy Space” is an arcade in the space style, where you should try to overcome as many " +
                    "obstacles as possible on the space plate. The shields of the ship have three charges capable of protecting" +
                    " the ship from impacts with obstacles."+"Towards to space adventures! Go through the obstacles on a space plate!\n" +
                    "The game “Flappy Space” is an arcade in the space style, where you should try to overcome as many " +
                    "obstacles as possible on the space plate. The shields of the ship have three charges capable of protecting" +
                    " the ship from impacts with obstacles.";
    public BottomPause(PlayScreen parent){
        this.parent = parent;


    }
    public void toVisible(){
        table = new Table(parent.getSkin());
        TextureRegionDrawable texture = new TextureRegionDrawable(HM.game.texture.atlas.findRegion("bottom"));
        table.setBackground(texture); //table.debug();
        table.setSize(parent.getStage().getWidth()*1f, parent.getStage().getHeight()*0.35f);
        table.setPosition(0,0);

        title = new Label("Pause", parent.getSkin(), "title");
        title.setAlignment(Align.center);

        infoScroll = new Label(infoText,  parent.getSkin());
        infoScroll.setWrap(true);

        scrollTable = new Table();
        scrollTable.add(infoScroll).width(table.getWidth() * 0.9f);
        scroller = new ScrollPane(scrollTable,  parent.getSkin());
        scroller.setScrollingDisabled(true, false);
        scroller.setFadeScrollBars(false);
        //scroller.setFlickScroll(false);


        table.add(title).expand().padTop(table.getHeight()*0.05f).row();
        table.add(scroller).width(table.getWidth()).row();

        parent.getStage().addActor(table);
    }
    public void toDisappear(){
        table.remove();
    }
}
