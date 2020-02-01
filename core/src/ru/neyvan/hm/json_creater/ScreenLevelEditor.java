package ru.neyvan.hm.json_creater;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.ScreenAdapter;
import com.badlogic.gdx.files.FileHandle;
import com.badlogic.gdx.graphics.Color;
import com.badlogic.gdx.graphics.GL20;
import com.badlogic.gdx.scenes.scene2d.Actor;
import com.badlogic.gdx.scenes.scene2d.Stage;
import com.badlogic.gdx.scenes.scene2d.ui.CheckBox;
import com.badlogic.gdx.scenes.scene2d.ui.HorizontalGroup;
import com.badlogic.gdx.scenes.scene2d.ui.Label;
import com.badlogic.gdx.scenes.scene2d.ui.ScrollPane;
import com.badlogic.gdx.scenes.scene2d.ui.SelectBox;
import com.badlogic.gdx.scenes.scene2d.ui.Skin;
import com.badlogic.gdx.scenes.scene2d.ui.Table;
import com.badlogic.gdx.scenes.scene2d.ui.TextArea;
import com.badlogic.gdx.scenes.scene2d.ui.TextButton;
import com.badlogic.gdx.scenes.scene2d.ui.TextField;
import com.badlogic.gdx.scenes.scene2d.ui.VerticalGroup;
import com.badlogic.gdx.scenes.scene2d.ui.Window;
import com.badlogic.gdx.scenes.scene2d.utils.ChangeListener;
import com.badlogic.gdx.utils.Align;
import com.badlogic.gdx.utils.Array;
import com.badlogic.gdx.utils.Json;
import com.badlogic.gdx.utils.JsonWriter;
import com.badlogic.gdx.utils.viewport.ExtendViewport;
import java.util.ArrayList;
import java.util.Iterator;

import ru.neyvan.hm.Constants;
import ru.neyvan.hm.surprises.Surprise;
import ru.neyvan.hm.terms.AdditionNumerals;
import ru.neyvan.hm.terms.ArithmeticProgression;
import ru.neyvan.hm.terms.Divisibility;
import ru.neyvan.hm.terms.GeometricProgression;
import ru.neyvan.hm.terms.LastNumeral;
import ru.neyvan.hm.terms.MultiplicationNumerals;
import ru.neyvan.hm.terms.Simple;
import ru.neyvan.hm.terms.SquareNumber;
import ru.neyvan.hm.terms.Term;

/**
 * Created by AndyGo on 17.01.2018.
 */

public class ScreenLevelEditor extends ScreenAdapter {
    private Stage stage;
    private Skin uiSkin;
    private ScrollPane scrollPane;
    private VerticalGroup group;

    private Table table1;
    private TextButton btnSave, btnOpen;

    private Table table2;
    private Label lbEpisode, lbLevel, lbBackground;
    private TextField tfEpisode, tfLevel;
    private SelectBox<Integer> sbBackground;
    private static Integer[] i_backgrounds;

    private Table table3;
    private Label lbFirstNumber, lbCountOfMoves, lbDeltaNumbers;
    private TextField tfFirstNumber, tfCountOfMoves, tfDeltaNumbers;
    private CheckBox cBFixedCounting;
    private TextArea listFixedNumbers;

    private Table table4;
    private Label lbTerms;
    private TextButton btnAddTerm, btnRemTerm;
    public Array<TermBox> termBoxes;

    private Table table4c;
    private Label lbCheck;
    private TextButton btnAddCheck, btnRemCheck;
    public Array<CheckBoxxx> checkBoxes;

    private Table table5;
    private Label lbTimeTitle;
    private Label lbStep, lbAfterStep, lbChange, lbAcChange;
    private TextField tfStep, tfAfterStep, tfChange, tfAcChange;

    private Table table6;
    private TextButton btnAddSurp, btnRemSurp;
    private Label lbSurprises;
    private CheckBox cbOutOrder, cbRandom;

    public Array<SurpBox> surpBoxes;

    MyFrame myFrame;

    @Override
    public void show() {
        super.show();
        stage = new Stage(new ExtendViewport(1200, 700));
        stage.setDebugAll(false);
        Gdx.input.setInputProcessor(stage);
        uiSkin = new Skin(Gdx.files.internal("editor/uiskin.json"));

        //stage.addListener(new Exit)
        //**********************************************************************
        // ********************Table save and open*************************
        //**********************************************************************
        btnSave = new TextButton("Save", uiSkin);
        btnOpen = new TextButton("Open", uiSkin);
        btnSave.addListener(new ChangeListener() {
            @Override
            public void changed(ChangeEvent event, Actor actor) {
                saveFile(null);
            }
        });
        btnOpen.addListener(new ChangeListener() {
            @Override
            public void changed(ChangeEvent event, Actor actor) {
                openFile();
            }
        });

        table1 = new Table();
        table1.pad(10f);
        table1.add(btnSave).width(200).expandX();
        table1.add(btnOpen).width(200).expandX();
        //**********************************************************************
        // ********************Table level and episode*************************
        //**********************************************************************
        lbEpisode = new Label("Episode:", uiSkin);
        lbLevel = new Label("Level:", uiSkin);
        lbBackground = new Label("Background:", uiSkin);
        tfEpisode = new TextField("1", uiSkin);
        tfLevel = new TextField("1", uiSkin);
        i_backgrounds = new Integer[Constants.MAX_BACKGROUNDS];
        for (int i = 0; i < Constants.MAX_BACKGROUNDS; i++){
            i_backgrounds[i] = i;
        }
        sbBackground = new SelectBox<Integer>(uiSkin);
        sbBackground.setItems(i_backgrounds);

        table2 = new Table(uiSkin);
        table2.setBackground( "panel-orange");
        table2.columnDefaults(1).width(150);
        table2.pad(10f);
        table2.add(new Label("Level, episode and background", uiSkin, "title")).colspan(2); table2.row();
        table2.add(lbEpisode, tfEpisode); table2.row();
        table2.add(lbLevel, tfLevel);table2.row();
        table2.add(lbBackground, sbBackground);
        //**********************************************************************
        // ********************Table system of counting*************************
        //**********************************************************************
        lbFirstNumber = new Label("First Number:", uiSkin);
        lbCountOfMoves = new Label("Count of moves:", uiSkin);
        lbDeltaNumbers = new Label("Delta of change number for player turn:", uiSkin);
        tfFirstNumber = new TextField("1", uiSkin);
        tfCountOfMoves= new TextField("50", uiSkin);
        tfDeltaNumbers= new TextField("2", uiSkin);
        cBFixedCounting = new CheckBox(" Ignore system of counting higher and used fixed numbers", uiSkin);
        cBFixedCounting.setChecked(false);
        cBFixedCounting.addListener(new ChangeListener() {
            @Override
            public void changed(ChangeEvent event, Actor actor) {
                if(cBFixedCounting.isChecked()){
                    listFixedNumbers.setColor(Color.WHITE);
                    listFixedNumbers.setDisabled(false);
                    tfFirstNumber.setColor(Color.GRAY);tfCountOfMoves.setColor(Color.GRAY);tfDeltaNumbers.setColor(Color.GRAY);
                    tfFirstNumber.setDisabled(true); tfCountOfMoves.setDisabled(true);tfDeltaNumbers.setDisabled(true);
                }else{
                    listFixedNumbers.setColor(Color.GRAY);
                    listFixedNumbers.setDisabled(true);
                    tfFirstNumber.setColor(Color.WHITE);tfCountOfMoves.setColor(Color.WHITE);tfDeltaNumbers.setColor(Color.WHITE);
                    tfFirstNumber.setDisabled(false); tfCountOfMoves.setDisabled(false);tfDeltaNumbers.setDisabled(false);
                }
            }
        });

        listFixedNumbers = new TextArea("",uiSkin);
        listFixedNumbers.setColor(Color.GRAY);
        listFixedNumbers.setDisabled(true);
        listFixedNumbers.setTextFieldFilter(new TextField.TextFieldFilter() {
            @Override
            public boolean acceptChar(TextField textField, char c) {
                if (Character.toString(c).matches("^[0-9,]")) {
                    if(c==',')if(listFixedNumbers.getText().isEmpty()||listFixedNumbers.getText().endsWith(","))return false;
                    return true;
                }else if(c=='.' || c==' '){
                    if(listFixedNumbers.getText().isEmpty()||listFixedNumbers.getText().endsWith(","))return false;
                    textField.appendText(",");
                    return false;
                }
                return false;
            }
        });

        table3 = new Table(uiSkin);
        table3.setBackground( "panel-orange");
        table3.columnDefaults(1).width(150);
        table3.pad(10f);
        table3.add(new Label("System of Counting", uiSkin, "title")).colspan(2); table3.row();
        table3.add(lbFirstNumber, tfFirstNumber); table3.row();
        table3.add(lbCountOfMoves, tfCountOfMoves); table3.row();
        table3.add(lbDeltaNumbers, tfDeltaNumbers);table3.row();
        table3.add(cBFixedCounting).colspan(2);table3.row();
        table3.add(listFixedNumbers).maxWidth(500f).size(500f,100f).colspan(2);table3.row();
        //**********************************************************************
        // ********************    Terms of win     ***********************
        //**********************************************************************
        lbTerms = new Label("Terms of win", uiSkin, "title");
        termBoxes = new Array<TermBox>();
        btnAddTerm = new TextButton("Add Term", uiSkin);
        btnRemTerm = new TextButton("Remove Term", uiSkin);
        btnAddTerm.addListener(new ChangeListener() {
            @Override
            public void changed(ChangeEvent event, Actor actor) {
                if(termBoxes.size >= 26) return;
                TermBox termBox = new TermBox();
                termBoxes.add(termBox);
                table4.row();
                table4.add(termBox.box).left().colspan(2);
                for(int i=0; i<checkBoxes.size; i++){
                    checkBoxes.get(i).updateInfo();
                }
            }
        });
        btnRemTerm.addListener(new ChangeListener() {
            @Override
            public void changed(ChangeEvent event, Actor actor) {
                if(termBoxes.size == 0) return;
                table4.removeActor(termBoxes.get(termBoxes.size-1).box);
                termBoxes.removeIndex(termBoxes.size-1);
                for(int i=0; i<checkBoxes.size; i++){
                    checkBoxes.get(i).updateInfo();
                }
            }
        });
        table4 = new Table(uiSkin);
        table4.setBackground( "panel-orange");
        table4.pad(10f);
        table4.add(lbTerms).colspan(2).row();
        table4.add(btnAddTerm).width(300).expandX();
        table4.add(btnRemTerm).width(300).expandX();
        //**********************************************************************
        // ********************    Checks     ***********************
        //**********************************************************************
        lbCheck = new Label("Conditions of checking move", uiSkin, "title");
        checkBoxes = new Array<CheckBoxxx>();
        btnAddCheck = new TextButton("Add Check", uiSkin);
        btnRemCheck = new TextButton("Remove Term", uiSkin);
        btnAddCheck.addListener(new ChangeListener() {
            @Override
            public void changed(ChangeEvent event, Actor actor) {
                if(termBoxes.size == 0 || checkBoxes.size >= 10) return;
                CheckBoxxx checkBoxxx = new CheckBoxxx();
                checkBoxes.add(checkBoxxx);
                table4c.row();
                table4c.add(checkBoxxx.box).left().colspan(2);
                //System.out.println(table4.getColumns());
            }
        });
        btnRemCheck.addListener(new ChangeListener() {
            @Override
            public void changed(ChangeEvent event, Actor actor) {
                if(checkBoxes.size == 0) return;
                table4c.removeActor(checkBoxes.get(checkBoxes.size-1).box);
                checkBoxes.removeIndex(checkBoxes.size-1);
            }
        });
        table4c = new Table(uiSkin);
        table4c.setBackground( "panel-orange");
        table4c.pad(10f);
        table4c.add(lbCheck).colspan(2).row();
        table4c.add(btnAddCheck).width(300).expandX();
        table4c.add(btnRemCheck).width(300).expandX();
        //**********************************************************************
        // ********************    Contoller of time     ***********************
        //**********************************************************************
        lbTimeTitle = new Label("Contoller of time", uiSkin, "title");
        lbStep = new Label("Step: Time for move:", uiSkin);
        lbAfterStep = new Label("AfterStep: Time for rest after move:", uiSkin);
        lbChange = new Label("Speed of change Step and AfterStep \n (Step += Speed, AfterStep+= Speed):", uiSkin);
        lbAcChange = new Label("Acceleration (Speed += Acceleration):", uiSkin);
        tfStep = new TextField("1.7", uiSkin);
        tfAfterStep = new TextField("1.5", uiSkin);
        tfChange= new TextField("0", uiSkin);
        tfAcChange= new TextField("0", uiSkin);

        table5 = new Table(uiSkin);
        table5.setBackground( "panel-orange");
        table5.pad(10f);
        table5.add(lbTimeTitle).colspan(2).row();
        table5.add(lbStep).width(350).expandX();
        table5.add(tfStep).width(200).expandX();table5.row();
        table5.add(lbAfterStep).width(350).expandX();
        table5.add(tfAfterStep).width(200).expandX();table5.row();
        table5.add(lbChange).width(350).expandX();
        table5.add(tfChange).width(200).expandX();table5.row();
        table5.add(lbAcChange).width(350).expandX();
        table5.add(tfAcChange).width(200).expandX();table5.row();
        //**********************************************************************
        // *******************  Bonuses and debuffes     ***********************
        //**********************************************************************
        lbSurprises = new Label("Surprises", uiSkin, "title");
        surpBoxes = new Array<SurpBox>();
        btnAddSurp = new TextButton("Add Surprise", uiSkin);
        btnRemSurp = new TextButton("Remove Surprise", uiSkin);
        btnAddSurp.addListener(new ChangeListener() {
            @Override
            public void changed(ChangeEvent event, Actor actor) {
                if(surpBoxes.size > 30) return;
                SurpBox surpBox = new SurpBox();
                surpBoxes.add(surpBox);
                table6.row();
                table6.add(surpBox.box).left().colspan(2);
                //System.out.println(table4.getColumns());
            }
        });
        btnRemSurp.addListener(new ChangeListener() {
            @Override
            public void changed(ChangeEvent event, Actor actor) {
                if(surpBoxes.size == 0) return;
                table6.removeActor(surpBoxes.get(surpBoxes.size-1).box);
                surpBoxes.removeIndex(surpBoxes.size-1);
            }
        });
        cbOutOrder = new CheckBox("Surprise can generate not in the order of the list", uiSkin);
        cbRandom = new CheckBox("Surprise can generate in any move", uiSkin);
        cbRandom.addListener(new ChangeListener() {
            @Override
            public void changed(ChangeEvent event, Actor actor) {
                cbOutOrder.setDisabled(cbRandom.isChecked());
                if(cbRandom.isChecked())cbOutOrder.setColor(0,0,0,0.3f);
                if(!cbRandom.isChecked())cbOutOrder.setColor(1,1,1,1f);
            }
        });
        table6 = new Table(uiSkin);
        table6.setBackground( "panel-orange");
        table6.pad(10f);
        table6.add(lbSurprises).colspan(2).row();
        table6.add(btnAddSurp).width(300).expandX();
        table6.add(btnRemSurp).width(300).expandX();
        table6.row();
        table6.add(cbOutOrder).colspan(2);
        table6.row();
        table6.add(cbRandom).colspan(2);

        //**********************************************************************
        // ********************       Finish     *******************************
        //**********************************************************************
        group = new VerticalGroup();
        group.pad(10f);
        group.padBottom(100f);
        group.setWidth(0.7f * stage.getWidth());
        group.addActor(new Label("LEVEL EDITOR", uiSkin, "title"));
        group.addActor(table1);
        group.addActor(table2);
        group.addActor(table3);
        group.addActor(table4);
        group.addActor(table4c);
        group.addActor(table5);
        group.addActor(table6);
        //group.setFillParent(true);
        scrollPane = new ScrollPane(group);
        scrollPane.setFillParent(true);
        stage.addActor(scrollPane);
    }

    @Override
    public void render(float delta) {
        Gdx.gl.glClearColor(1, 1, 1, 1);
        Gdx.gl.glClear(GL20.GL_COLOR_BUFFER_BIT);

        stage.act(delta);
        stage.draw();
    }

    @Override
    public void resize(int width, int height) {
        super.resize(width, height);
        stage.getViewport().update(width, height, true);
    }
    String[] stringsTerms = new String[]{"Choose Condition", "AdditionNumerals", "ArithmeticProgression", "Divisibility",
            "GeometricProgression", "LastNumeral", "MultiplicationNumerals", "Simple", "SquareNumber"};
    public static final int AdditionNumerals = 1;
    public static final int ArithmeticProgression = 2;
    public static final int Divisibility = 3;
    public static final int GeometricProgression = 4;
    public static final int LastNumeral = 5;
    public static final int MultiplicationNumerals = 6;
    public static final int Simple = 7;
    public static final int SquareNumber = 8;

    private class TermBox{
        private int ID;
        private HorizontalGroup box;
        private HorizontalGroup boxInBox;
        private Label labelID;
        private SelectBox<String> selectBox;

        public TermBox(){
            ID = termBoxes.size;
            char b = (char)(65+ID);
            String text = b+"";
            labelID = new Label(text, uiSkin, "title");
            selectBox = new SelectBox<String>(uiSkin);
            selectBox.setItems(stringsTerms);
            selectBox.addListener(new ChangeListener() {
                @Override
                public void changed(ChangeEvent event, Actor actor) {
                    addTerm(1, 1);
                }
            });
            box = new HorizontalGroup();
            box.pad(5f);
            box.space(15f);
            box.addActor(labelID);
            box.addActor(selectBox);
        }
        public TermBox(int typeTerm, int a, int b){
            this();
            System.out.print(selectBox.toString());
            selectBox.setSelectedIndex(typeTerm);
            addTerm(a, b);
        }
        private void addTerm(int a, int b){
            if(boxInBox == null){
                boxInBox = new HorizontalGroup();
                box.addActor(boxInBox);
            }else{
                boxInBox.clear();
            }
            switch (selectBox.getSelectedIndex()){
                case Simple:
                case SquareNumber:
                    boxInBox.addActor(new Label("All OK, selected", uiSkin));
                    break;
                case AdditionNumerals:
                case MultiplicationNumerals:
                case Divisibility:
                    TextField fieldCondition = new TextField(String.valueOf(a), uiSkin);
                    boxInBox.addActor(fieldCondition);
                    break;
                case LastNumeral:
                case ArithmeticProgression:
                case GeometricProgression:
                    TextField fieldCondition2 = new TextField(String.valueOf(a), uiSkin);
                    TextField fieldCondition3 = new TextField(String.valueOf(b)+"", uiSkin);
                    boxInBox.addActor(fieldCondition2);
                    boxInBox.addActor(fieldCondition3);
                    break;
            }
        }
    }
    String[] stringsChecks = new String[]{"Choose Condition", "OR", "AND", "NOT"};
    public static final int OR = 1;
    public static final int AND = 2;
    public static final int NOT = 3;
    private class CheckBoxxx{
        private int ID;
        private HorizontalGroup box;
        private Label labelID;
        private SelectBox<String> selectBox;
        private SelectBox<Character> selectBox1;
        private SelectBox<Character> selectBox2;

        public CheckBoxxx(){
            ID = checkBoxes.size;
            final String text = ID+"";

            labelID = new Label(text, uiSkin, "title");

            selectBox = new SelectBox<String>(uiSkin);
            selectBox.setItems(stringsChecks);

            selectBox.addListener(new ChangeListener() {
                @Override
                public void changed(ChangeEvent event, Actor actor) {
                    selectBox2.setDisabled(false);
                    selectBox2.setColor(1,1,1,1);
                    if(selectBox.getSelectedIndex()==NOT){
                        selectBox2.setDisabled(true);
                        selectBox2.setColor(1,1,1,0.3F);
                    }
                }
            });

            selectBox1 = new SelectBox<Character>(uiSkin);
            selectBox2 = new SelectBox<Character>(uiSkin);
            updateInfo();

            box = new HorizontalGroup();
            box.pad(5f);
            box.space(15f);
            box.addActor(labelID);
            box.addActor(selectBox);
            box.addActor(selectBox1);
            box.addActor(selectBox2);
        }
        public CheckBoxxx(int firstID, int secondID, int operation){
            this();
            selectBox.setSelectedIndex(operation);
            if(firstID < 97) firstID = firstID + 48;
            if(secondID < 97) secondID = secondID + 48;
            selectBox1.setSelected((char)(firstID));
            selectBox2.setSelected((char)(secondID));
        }
        public void updateInfo(){

            int countTerms = termBoxes.size;
            int maxChecksForThis = ID;
            Character[] idMassiv = new Character[maxChecksForThis+countTerms];
            for(int i=0; i<countTerms; i++){
                idMassiv[i] = (char)(97+i);
            }
            int a = 0;
            for(int i=countTerms; i<idMassiv.length; i++){
                idMassiv[i] = (char)(48+a);
                a++;
            }
            selectBox1.setItems(idMassiv);
            selectBox2.setItems(idMassiv);
        }
    }

    String[] stringsSurp = new String[]{"Choose Surprise", "ChangeSpeedTime", "Explosion", "FullFreezing", "GiftAndTrap",
                                        "HelpSurprise", "Rotation", "ScreenEffects", "Transference", "WarpSurprise"};
    String[] strGiftAndTrap = new String[]{"Choose Type", "Add LIFES", "Add SCORES", "Remove LIFES", "Remove SCORES"};
    String[] strScreenEffects = new String[]{"Choose Type", "COLOR_MUSIC", "INVERSION"};

    public static final int ChangeSpeedTime = 1;
    public static final int Explosion = 2;
    public static final int FullFreezing = 3;
    public static final int GiftAndTrap = 4;
    public static final int HelpSurprise = 5;
    public static final int Rotation = 6;
    public static final int ScreenEffects = 7;
    public static final int Transference = 8;
    public static final int WarpSurprise = 9;
    private class SurpBox{
        private int ID;
        private HorizontalGroup box;
        private HorizontalGroup boxInBox;
        private Label labelID;
        private SelectBox<String> selectBox;
        private Label lbPos;
        private TextField tfPos;
        private Label lbMaxTime;
        private TextField tfMaxTime;

        public SurpBox(){
            ID = surpBoxes.size;
            String text = Integer.toString(ID);
            labelID = new Label(text, uiSkin, "title");
            lbPos = new Label("Position:", uiSkin);
            String text2 = Integer.toString(ID*5);
            tfPos = new TextField(text2, uiSkin);
            lbMaxTime  = new Label("Max Time:", uiSkin);
            tfMaxTime = new TextField("1.0", uiSkin);
            selectBox = new SelectBox<String>(uiSkin);
            selectBox.setItems(stringsSurp);
            selectBox.addListener(new ChangeListener() {
                @Override
                public void changed(ChangeEvent event, Actor actor) {
                    addSurprise(1.5f, 2.5f, 0, false);
                }
            });
            box = new HorizontalGroup();
            box.pad(5f);
            box.space(15f);
            box.addActor(labelID);
            box.addActor(lbPos);
            box.addActor(tfPos);
            box.addActor(lbMaxTime);
            box.addActor(tfMaxTime);
            box.addActor(selectBox);
        }
        public SurpBox(int surprise, float maxTime, int position, float number1, float number2, int select, boolean check){
            this();
            selectBox.setSelectedIndex(surprise);
            tfMaxTime.setText(String.valueOf(maxTime));
            tfPos.setText(String.valueOf(position));
            addSurprise(number1, number2, select, check);
        }
        private void addSurprise(float number1, float number2, int select, boolean check){
            if(boxInBox == null){
                boxInBox = new HorizontalGroup();
                box.addActor(boxInBox);
            }else{
                boxInBox.clear();
            }
            switch (selectBox.getSelectedIndex()){
                case ChangeSpeedTime:
                case WarpSurprise:
                    TextField fieldCondition = new TextField(String.valueOf(number1), uiSkin);
                    boxInBox.addActor(fieldCondition);
                    break;
                case Explosion:
                    TextField fieldCondition1 = new TextField(String.valueOf((int)(number1)), uiSkin);
                    boxInBox.addActor(fieldCondition1);
                    break;
                case GiftAndTrap:
                    SelectBox<String> selectBox = new SelectBox<String>(uiSkin);
                    selectBox.setItems(strGiftAndTrap);
                    selectBox.setSelectedIndex(select);
                    boxInBox.addActor(selectBox);
                    TextField fieldCondition2 = new TextField(String.valueOf((int)(number1)), uiSkin);
                    boxInBox.addActor(fieldCondition2);
                    break;
                case ScreenEffects:
                    SelectBox<String> selectBox2 = new SelectBox<String>(uiSkin);
                    selectBox2.setItems(strScreenEffects);
                    selectBox2.setSelectedIndex(select);
                    boxInBox.addActor(selectBox2);
                    break;
                case Transference:
                    TextField fieldCondition3 = new TextField(String.valueOf(number1), uiSkin);
                    boxInBox.addActor(fieldCondition3);
                    TextField fieldCondition4 = new TextField(String.valueOf(number2), uiSkin);
                    boxInBox.addActor(fieldCondition4);
                    break;
                case FullFreezing:
                case HelpSurprise:
                    boxInBox.addActor(new Label("All OK, selected", uiSkin));
                    break;
                case Rotation:
                    TextField fieldCondition5 = new TextField(String.valueOf(number1), uiSkin);
                    fieldCondition5.setMessageText("Speed of Rotation");
                    boxInBox.addActor(fieldCondition5);
                    CheckBox checkBox = new CheckBox("One Rotation", uiSkin);
                    checkBox.setChecked(check);
                    boxInBox.addActor(checkBox);
                    break;
            }
        }
    }
    public void openFile() {

        Level level = null;
        try {
            myFrame = new MyFrame();
            level = myFrame.openFile();
            myFrame.dispose();
        }catch (Exception e){
            System.out.println(e);
        }
        if(level == null){
            WindowError windowError = new WindowError("File don't open!", uiSkin, "Empty",  stage);
            windowError.setPosition(stage.getWidth()/2, stage.getHeight()/2, Align.center);
            stage.addActor(windowError);
            return;
        }
        try {
            tfEpisode.setText(Integer.toString(level.getEpisode()));
            tfLevel.setText(Integer.toString(level.getCount_level()));
            sbBackground.setSelectedIndex(level.getI_background());
            tfFirstNumber.setText(Integer.toString(level.getFirstNumber()));
            tfCountOfMoves.setText(Integer.toString(level.getCountOfMoves()));
            tfDeltaNumbers.setText(Integer.toString(level.getDeltaNumbers()));
            cBFixedCounting.setChecked(level.isFixedCounting());
            listFixedNumbers.setText("");
            if(level.isFixedCounting()) {

                ArrayList<Integer> list = level.getFixedNumbers();
                for (int i = 0; i < list.size(); i++) {
                    listFixedNumbers.appendText(String.valueOf(list.get(i)));
                    if(i != list.size()-1)listFixedNumbers.appendText(",");
                }
            }
            while (termBoxes.size != 0){
                table4.removeActor(termBoxes.get(termBoxes.size-1).box);
                termBoxes.removeIndex(termBoxes.size-1);
            }
            ArrayList<Term> terms  = level.getTerms();
            Iterator<Term> termIterator = terms.iterator();
            while (termIterator.hasNext()){
                Term term = termIterator.next();
                TermBox termBox = null;
                if(term instanceof Simple) {
                    termBox = new TermBox(Simple, 0, 0);
                }else if (term instanceof SquareNumber){
                    termBox = new TermBox(SquareNumber, 0, 0);
                }else if (term instanceof AdditionNumerals ){
                    AdditionNumerals newTerm = (AdditionNumerals)(term);
                    termBox = new TermBox(AdditionNumerals, newTerm.getIdeal(), 0);
                }else if (term instanceof MultiplicationNumerals ){
                    MultiplicationNumerals newTerm = (MultiplicationNumerals)(term);
                    termBox = new TermBox(MultiplicationNumerals, newTerm.getIdeal(), 0);
                }else if (term instanceof Divisibility ){
                    Divisibility newTerm = (Divisibility)(term);
                    termBox = new TermBox(Divisibility, newTerm.getDivider(), 0);
                }else if (term instanceof LastNumeral ){
                    LastNumeral newTerm = (LastNumeral)(term);
                    termBox = new TermBox(LastNumeral, newTerm.getNumberPosition(), newTerm.getLastNumeral());
                }else if (term instanceof ArithmeticProgression){
                    ArithmeticProgression newTerm = (ArithmeticProgression)(term);
                    termBox = new TermBox(ArithmeticProgression, newTerm.getFirst(), newTerm.getDifference());
                }else if (term instanceof ru.neyvan.hm.terms.GeometricProgression){
                    GeometricProgression newTerm = (GeometricProgression)(term);
                    termBox = new TermBox(GeometricProgression, newTerm.getFirst(), newTerm.getCommonRatio());
                }
                if(termBox!=null){
                    termBoxes.add(termBox);
                    table4.row();
                    table4.add(termBox.box).left().colspan(2);
                }
            }
            while (checkBoxes.size != 0){
                table4c.removeActor(checkBoxes.get(checkBoxes.size-1).box);
                checkBoxes.removeIndex(checkBoxes.size-1);
            }
            ArrayList<Check> checks  = level.getChecksOfMove();
            Iterator<Check> checkIterator = checks.iterator();
            while (checkIterator.hasNext()){
                Check check = checkIterator.next();
                CheckBoxxx checkBoxxx = new CheckBoxxx(check.getIdFirstOperand(), check.getIdSecondOperand(), check.getTypeOfOperation());

                if(checkBoxxx!=null){
                    checkBoxes.add(checkBoxxx);
                    table4c.row();
                    table4c.add(checkBoxxx.box).left().colspan(2);
                }
            }

            while (surpBoxes.size != 0){
                table6.removeActor(surpBoxes.get(surpBoxes.size-1).box);
                surpBoxes.removeIndex(surpBoxes.size-1);
            }
            tfStep.setText(Float.toString(level.getTimeStep()));
            tfAfterStep.setText(Float.toString(level.getTimeAfterStep()));
            tfChange.setText(Float.toString(level.getSpeedChangeTS()));
            tfAcChange.setText(Float.toString(level.getAccelerationSpeedChangeTS()));

            ArrayList<Surprise> surprises  = level.getSurprises();
            ArrayList<Integer> places  = level.getListOfPlacesSurp();
            Iterator<Surprise> surpIterator = surprises.iterator();
            Iterator<Integer> placeIterator = places.iterator();
            while (surpIterator.hasNext()){
                Surprise surprise = surpIterator.next();
                int place = placeIterator.next();
                SurpBox surpBox = null;
                float maxTime  = surprise.getMaxTime();
                if(surprise instanceof ru.neyvan.hm.surprises.FullFreezing){
                    surpBox = new SurpBox(FullFreezing, maxTime, place, 0, 0, 0, false);
                }else if(surprise instanceof ru.neyvan.hm.surprises.HelpSurprise){
                    surpBox = new SurpBox(HelpSurprise, maxTime, place,0, 0, 0, false);
                }else if(surprise instanceof ru.neyvan.hm.surprises.ChangeSpeedTime){
                    ru.neyvan.hm.surprises.ChangeSpeedTime newSurp = (ru.neyvan.hm.surprises.ChangeSpeedTime)(surprise);
                    surpBox = new SurpBox(ChangeSpeedTime, maxTime, place, newSurp.getMultiplierTime(), 0, 0, false);
                }else if(surprise instanceof ru.neyvan.hm.surprises.Explosion){
                    ru.neyvan.hm.surprises.Explosion newSurp = (ru.neyvan.hm.surprises.Explosion)(surprise);
                    surpBox = new SurpBox(Explosion, maxTime, place, newSurp.getMaxNumberExplosions(), 0, 0, false);
                }else if(surprise instanceof ru.neyvan.hm.surprises.WarpSurprise){
                    ru.neyvan.hm.surprises.WarpSurprise newSurp = (ru.neyvan.hm.surprises.WarpSurprise)(surprise);
                    surpBox = new SurpBox(WarpSurprise, maxTime, place, newSurp.getSpeedWarp(), 0, 0, false);
                }else if(surprise instanceof ru.neyvan.hm.surprises.GiftAndTrap){
                    ru.neyvan.hm.surprises.GiftAndTrap newSurp = (ru.neyvan.hm.surprises.GiftAndTrap)(surprise);
                    surpBox = new SurpBox(GiftAndTrap, maxTime, place, newSurp.getNumber(), 0, newSurp.getType(), false);
                }else if(surprise instanceof ru.neyvan.hm.surprises.ScreenEffects){
                    ru.neyvan.hm.surprises.ScreenEffects newSurp = (ru.neyvan.hm.surprises.ScreenEffects)(surprise);
                    surpBox = new SurpBox(ScreenEffects, maxTime, place, 0, 0, newSurp.getType(), false);
                }else if(surprise instanceof ru.neyvan.hm.surprises.Transference){
                    ru.neyvan.hm.surprises.Transference newSurp = (ru.neyvan.hm.surprises.Transference)(surprise);
                    surpBox = new SurpBox(Transference, maxTime, place, newSurp.getSpeedX(), newSurp.getSpeedY(), 0, false);
                }else if(surprise instanceof ru.neyvan.hm.surprises.Rotation){
                    ru.neyvan.hm.surprises.Rotation newSurp = (ru.neyvan.hm.surprises.Rotation)(surprise);
                    surpBox = new SurpBox(Rotation, maxTime, place, newSurp.getSpeed(), 0, 0, newSurp.isOneCircle());
                }
                if(surprise != null){
                    surpBoxes.add(surpBox);
                    table6.row();
                    table6.add(surpBox.box).left().colspan(2);
                }
            }
            cbOutOrder.setChecked(level.isOutOfOrderAppearanceSurprise());
            cbRandom.setChecked(level.isRandomSurpriseMove());
        }catch (Exception e){
            WindowError windowError = new WindowError("Error", uiSkin, e.toString() +"\n" + level.toString(),  stage);
            windowError.setPosition(stage.getWidth()/2, stage.getHeight()/2, Align.center);
            stage.addActor(windowError);
            System.err.println(e.toString());
            return;
        }
        WindowMessage windowMessage = new WindowMessage("File open", uiSkin, level.toString(),  stage);
        windowMessage.setPosition(stage.getWidth()/2, stage.getHeight()/2, Align.center);
        stage.addActor(windowMessage);
        System.out.println(level.toString());

    }

    public void load(FileHandle file) {
        Json json = new Json(JsonWriter.OutputType.minimal);
    }

    private DesktopWorker desktopWorker;

    private void saveFile(final Runnable runnable){
        String error = new String();
        final Level level = new Level();
        try {
            level.setEpisode(Integer.parseInt(tfEpisode.getText()));
            level.setCount_level(Integer.parseInt(tfLevel.getText()));
            level.setI_background(sbBackground.getSelected());
            level.setFirstNumber(Integer.parseInt(tfFirstNumber.getText()));
            level.setCountOfMoves(Integer.parseInt(tfCountOfMoves.getText()));
            level.setDeltaNumbers(Integer.parseInt(tfDeltaNumbers.getText()));
            level.setFixedCounting(cBFixedCounting.isChecked());
            if(level.isFixedCounting()) {
                ArrayList<Integer> list = new ArrayList<Integer>();
                String text = listFixedNumbers.getText();
                if(text.equals("")){
                    error += "Fixed Counting is empty!\n";
                    int aaa = 0/0;
                }
                if(text.endsWith(",")){
                    text = text.substring(0, text.length()-1);
                }
                String texts[] = text.split(",");
            for (int i = 0; i < texts.length; i++) {
                    int a = Integer.parseInt(texts[i]);
                    list.add(a);
                }
                level.setFixedNumbers(list);
            }
            ArrayList<Term> list2 = new ArrayList<Term>();
            for(int i = 0; i < termBoxes.size; i++){
                TermBox termBox = termBoxes.get(i);
                int ID = termBox.ID;
                Term term = null;
                switch (termBox.selectBox.getSelectedIndex()) {
                    case 0:
                        error += "Term "+ID+" is not initialised!\n";
                        int a = 0/0;
                    case Simple:
                        term = new Simple(ID);
                        break;
                    case SquareNumber:
                        term = new SquareNumber(ID);
                        break;
                    case AdditionNumerals:
                        TextField textField1 = (TextField)(termBox.boxInBox.getChildren().get(0));
                        int a1 = Integer.parseInt(textField1.getText());
                        term = new AdditionNumerals(ID, a1);
                        break;
                    case MultiplicationNumerals:
                        TextField textField2 = (TextField)(termBox.boxInBox.getChildren().get(0));
                        int a2= Integer.parseInt(textField2.getText());
                        term = new MultiplicationNumerals(ID, a2);
                        break;
                    case Divisibility:
                        TextField textField3 = (TextField)(termBox.boxInBox.getChildren().get(0));
                        int a3= Integer.parseInt(textField3.getText());
                        term = new Divisibility(ID, a3);
                        break;
                    case LastNumeral:
                        TextField textField4 = (TextField)(termBox.boxInBox.getChildren().get(0));
                        int a4= Integer.parseInt(textField4.getText());
                        TextField textField5 = (TextField)(termBox.boxInBox.getChildren().get(1));
                        int a5= Integer.parseInt(textField5.getText());
                        term = new LastNumeral(ID, a4, a5);
                        break;
                    case ArithmeticProgression:
                        TextField textField6 = (TextField)(termBox.boxInBox.getChildren().get(0));
                        int a6= Integer.parseInt(textField6.getText());
                        TextField textField7 = (TextField)(termBox.boxInBox.getChildren().get(1));
                        int a7= Integer.parseInt(textField7.getText());
                        term = new LastNumeral(ID, a6, a7);
                        break;
                    case GeometricProgression:
                        TextField textField8 = (TextField)(termBox.boxInBox.getChildren().get(0));
                        int a8= Integer.parseInt(textField8.getText());
                        TextField textField9 = (TextField)(termBox.boxInBox.getChildren().get(1));
                        int a9 = Integer.parseInt(textField9.getText());
                        term = new LastNumeral(ID, a8, a9);
                        break;
                }
                list2.add(term);
            }
            level.setTerms(list2);
            ArrayList<Check> list3 = new ArrayList<Check>();
            for(int i = 0; i < checkBoxes.size; i++){
                CheckBoxxx checkBox = checkBoxes.get(i);
                int ID = checkBox.ID;
                int typeOfOperation = checkBox.selectBox.getSelectedIndex();
                if(typeOfOperation == 0){
                    error += "Operation "+ID+" is not initialised!\n";
                    int a = 0/0;
                }
                int firstOperand = checkBox.selectBox1.getSelected();
                int secondOperand = checkBox.selectBox2.getSelected();
                if(firstOperand < 97) firstOperand = firstOperand - 48;
                if(secondOperand < 97) secondOperand = secondOperand - 48;
                Check check = new Check(ID, typeOfOperation,  firstOperand, secondOperand);
                list3.add(check);
            }
            level.setChecksOfMove(list3);

            level.setTimeStep(Float.parseFloat(tfStep.getText()));
            level.setTimeAfterStep(Float.parseFloat(tfAfterStep.getText()));
            level.setSpeedChangeTS(Float.parseFloat(tfChange.getText()));
            level.setAccelerationSpeedChangeTS(Float.parseFloat(tfAcChange.getText()));

            ArrayList<Surprise> list4 = new ArrayList<Surprise>();
            ArrayList<Integer> list5 = new ArrayList<Integer>();
            for(int i=0; i<surpBoxes.size; i++){
                SurpBox surpBox = surpBoxes.get(i);
                Surprise surprise = null;
                float maxTime = Float.parseFloat(surpBox.tfMaxTime.getText());
                switch (surpBox.selectBox.getSelectedIndex()){
                    case 0:
                        error += "Surprise "+i+" is not initialised!\n";
                        int a = 0/0;
                    case ChangeSpeedTime:
                        TextField textField1 = (TextField)(surpBox.boxInBox.getChildren().get(0));
                        Float a1 = Float.parseFloat(textField1.getText());
                        surprise = new ru.neyvan.hm.surprises.ChangeSpeedTime(maxTime, a1);
                        break;
                    case Explosion:
                        TextField textField2 = (TextField)(surpBox.boxInBox.getChildren().get(0));
                        int a2 = Integer.parseInt(textField2.getText());
                        surprise = new ru.neyvan.hm.surprises.Explosion(maxTime, a2);
                        break;
                    case WarpSurprise:
                        TextField textField3 = (TextField)(surpBox.boxInBox.getChildren().get(0));
                        float a3 = Float.parseFloat(textField3.getText());
                        surprise = new ru.neyvan.hm.surprises.WarpSurprise(maxTime, a3);
                        break;
                    case GiftAndTrap:
                        SelectBox selectBox = (SelectBox)(surpBox.boxInBox.getChildren().get(0));
                        int a4 = selectBox.getSelectedIndex();
                       if(a4 == 0){
                           error += "Surprise "+i+" is not initialised almost!\n";
                           int aaa = 0/0;
                       }
                        TextField textField4 = (TextField)(surpBox.boxInBox.getChildren().get(1));
                        int a5 = Integer.parseInt(textField4.getText());
                        surprise = new ru.neyvan.hm.surprises.GiftAndTrap(maxTime, a4, a5);
                        break;
                    case ScreenEffects:
                        SelectBox selectBox2 = (SelectBox)(surpBox.boxInBox.getChildren().get(0));
                        int a6 = selectBox2.getSelectedIndex();
                        if(a6 == 0){
                            error += "Surprise "+i+" is not initialised almost!\n";
                            int aaa = 0/0;
                        }
                        surprise = new ru.neyvan.hm.surprises.ScreenEffects(maxTime, a6);
                        break;
                    case Transference:
                        TextField textField5 = (TextField)(surpBox.boxInBox.getChildren().get(0));
                        float a7 = Float.parseFloat(textField5.getText());
                        TextField textField6 = (TextField)(surpBox.boxInBox.getChildren().get(1));
                        float a8 = Float.parseFloat(textField6.getText());
                        surprise = new ru.neyvan.hm.surprises.Transference(maxTime, a7, a8);
                        break;
                    case FullFreezing:
                        surprise = new ru.neyvan.hm.surprises.FullFreezing(maxTime);
                        break;
                    case HelpSurprise:
                        surprise = new ru.neyvan.hm.surprises.HelpSurprise(maxTime);
                        break;
                    case Rotation:
                        TextField textField7 = (TextField)(surpBox.boxInBox.getChildren().get(0));
                        float a9 = Float.parseFloat(textField7.getText());
                        CheckBox checkBox = (CheckBox)(surpBox.boxInBox.getChildren().get(1));
                        boolean b1 = checkBox.isChecked();
                        surprise = new ru.neyvan.hm.surprises.Rotation(maxTime, a9, b1);
                        break;
                }
                list4.add(surprise);
                list5.add(Integer.parseInt(surpBox.tfPos.getText()));
            }
            level.setSurprises(list4);
            level.setListOfPlacesSurp(list5);
            level.setOutOfOrderAppearanceSurprise(cbOutOrder.isChecked());
            level.setRandomSurpriseMove(cbRandom.isChecked());
        }catch (Exception e){

            WindowError windowError = new WindowError("Error", uiSkin, error + e.toString(),  stage);
            windowError.setPosition(stage.getWidth()/2, stage.getHeight()/2, Align.center);
            stage.addActor(windowError);
            return;
        }


        showDialogLoading(new Runnable() {
            @Override
            public void run() {
                myFrame = new MyFrame();
                if(myFrame.saveFile(level)){
                    WindowMessage windowMessage = new WindowMessage("File save", uiSkin, level.toString(),  stage);
                    windowMessage.setPosition(stage.getWidth()/2, stage.getHeight()/2, Align.center);
                    stage.addActor(windowMessage);
                }else{
                    WindowError windowError = new WindowError("File don't save!", uiSkin, myFrame.message,  stage);
                    windowError.setPosition(stage.getWidth()/2, stage.getHeight()/2, Align.center);
                    stage.addActor(windowError);
                }
                System.out.println(level);
                myFrame.dispose();
            }
        });
    }

    public Skin getSkin() {
        return uiSkin;
    }
    public Stage getStage(){
        return stage;
    }
    public void showDialogLoading(Runnable runnable) {
        DialogLoading dialog = new DialogLoading("", runnable, this);
        dialog.show(this.getStage());
    }
    private class WindowError extends Window {

        Label info;
        TextButton btnOk;
        TextArea error;

        public WindowError(String title, final Skin skin, String errorInfo, final Stage stage) {
            super(title, skin);
            getTitleLabel().setAlignment(Align.center);
            setModal(true);

            info = new Label(title, skin);
            info.setWrap(true);

            error = new TextArea(errorInfo, skin);
            error.setDisabled(true);

            btnOk = new TextButton("Enter", skin);
            btnOk.addListener(new ChangeListener() {
                @Override
                public void changed(ChangeEvent event, Actor actor) {
                    remove();
                }
            });
            pad(64,30,30,30);
            add(info).prefWidth(stage.getWidth()*0.5f).pad(10).colspan(2).row();
            add(error).prefWidth(stage.getWidth()*0.5f).size(500, 200).colspan(2).row();
            add(btnOk).pad(10).colspan(2).row();
            pack();
        }

    }
    private class WindowMessage extends Window {

        Label info;
        TextButton btnOk;
        TextArea message;

        public WindowMessage(String title, final Skin skin, String messageInfo, final Stage stage) {
            super(title, skin);
            getTitleLabel().setAlignment(Align.center);
            setModal(true);

            info = new Label(title, skin);
            info.setWrap(true);

            message = new TextArea(messageInfo, skin);
            message.setDisabled(true);

            btnOk = new TextButton("Enter", skin);
            btnOk.addListener(new ChangeListener() {
                @Override
                public void changed(ChangeEvent event, Actor actor) {
                    remove();
                }
            });
            pad(64,30,30,30);
            add(info).prefWidth(stage.getWidth()*0.5f).pad(10).colspan(2).row();
            add(message).prefWidth(stage.getWidth()*0.5f).size(500, 200).colspan(2).row();
            add(btnOk).pad(10).colspan(2).row();
            pack();
        }

    }
}
