package ru.neyvan.hm.screens;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.math.Interpolation;
import com.badlogic.gdx.scenes.scene2d.Actor;
import com.badlogic.gdx.scenes.scene2d.actions.Actions;
import com.badlogic.gdx.scenes.scene2d.ui.Label;
import com.badlogic.gdx.scenes.scene2d.ui.Table;
import com.badlogic.gdx.scenes.scene2d.ui.TextButton;
import com.badlogic.gdx.scenes.scene2d.utils.ChangeListener;
import com.badlogic.gdx.utils.Align;

import ru.neyvan.hm.HM;
import ru.neyvan.hm.Records;

/**
 * Created by AndyGo on 13.10.2017.
 */

public class RecordsMenu extends ScreenMenuModel {
    private Label title, players[];
    private Label records[];
    private Table table;
    private TextButton btnBack;
    private float time;

    public RecordsMenu(boolean newRecordsman){
        super();
        if(newRecordsman){
            //players[HM.game.records.getNewRecordsman()].setText((FS.game.records.getNewRecordsman()+1)+". "+FS.game.records.getName(FS.game.records.getNewRecordsman()));
        }
        title = new Label(HM.game.bundle.get("recordTitle"), skin, "title");
        title.setWrap(true);
        title.setAlignment(Align.center);

        players = new Label[Records.MAX_RECORDSMEN];
        records = new Label[Records.MAX_RECORDSMEN];

        table = new Table(skin);
        table.setBackground("background");
        table.setSize(stage.getWidth()*0.7f, stage.getWidth()*1.19f);
        table.setPosition(stage.getWidth(), posY(table, 0.5f));
        table.add(title).colspan(2).width(table.getWidth()).fillY(); table.row();

//        for(int i = 0; i< Records.MAX_RECORDSMEN; i++){
//            players[i] = new Label((i+1)+". "+ HM.game.records.getName(i), skin);
//            players[i].setAlignment(Align.center);
//            records[i] = new Label(Integer.toString(HM.game.records.getRecord(i)), skin);
//            records[i].setAlignment(Align.center);
//            table.add(players[i]).expand().fillX(); table.add(records[i]).expand().fillX(); table.row();
//        }
        btnBack = new TextButton(HM.game.bundle.get("back"), skin);
        btnBack.addListener(new ChangeListener() {
            @Override
            public void changed(ChangeEvent event, Actor actor) {
                end();
            }
        });
        table.add(btnBack).colspan(2).expandX(); table.row();
        stage.addActor(table);


    }

    public void end(){
        Gdx.input.setInputProcessor(null);
        time = 0.5f;
        table.addAction(Actions.moveTo(stage.getWidth(), posY(table, 0.5f), time, Interpolation.circleIn));
        stage.addAction(Actions.sequence(
                Actions.delay(time),
                Actions.run(new Runnable() {
                    @Override
                    public void run() {
                        HM.game.setScreen(new MenuScreen(MenuScreen.APPEARANCE_FROM_LEFT));
                    }
                })
        ));
    }

    @Override
    public void show(){
        super.show();
        time = 0.5f;
        table.addAction(Actions.moveTo(posX(table, 0.5f), posY(table, 0.5f), time, Interpolation.pow3Out));
    }
    @Override
    public void render(float delta) {
        super.render(delta);
    }

    @Override
    public void back() {
        super.back(); end();
    }
}
